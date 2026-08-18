import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"
import { formatPaymentMonthLabel } from "@/lib/statements/payment-month"
import { splitProfileClientShare } from "@/lib/statements/splits"
import type { SplitProfile } from "@/lib/statements/types"

type RowForGenerate = {
  assignment_id: string
  program_name: string
  platform: string
  split_profile: SplitProfile
  gross_earned: number
  status: string
  display_title_override: string | null
  films: {
    film_id: string
    title: string
    production_company_id: string | null
    production_companies: { id: string; name: string } | null
  } | null
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json()
  const assignmentIds: string[] = Array.isArray(body.assignmentIds) ? body.assignmentIds : []
  const paymentMonth: string = body.paymentMonth
  if (assignmentIds.length === 0 || !paymentMonth) {
    return NextResponse.json({ error: "assignmentIds and paymentMonth are required." }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { data: rows, error: rowsError } = await admin
    .from("row_assignments")
    .select(
      "assignment_id, program_name, platform, split_profile, gross_earned, status, display_title_override, films(film_id, title, production_company_id, production_companies(id, name))"
    )
    .in("assignment_id", assignmentIds)

  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 })

  const typedRows = (rows ?? []) as unknown as RowForGenerate[]
  const eligible = typedRows.filter((r) => r.status === "ready" && r.films?.production_company_id)

  if (eligible.length === 0) {
    return NextResponse.json({ error: "None of the selected rows are ready." }, { status: 400 })
  }

  const warnings: string[] = []
  const skipped = assignmentIds.length - eligible.length
  if (skipped > 0) {
    warnings.push(`${skipped} selected row(s) were no longer ready and were skipped.`)
  }

  const byCompany = new Map<string, { name: string; rows: RowForGenerate[] }>()
  for (const row of eligible) {
    const company = row.films!.production_companies!
    if (!byCompany.has(company.id)) byCompany.set(company.id, { name: company.name, rows: [] })
    byCompany.get(company.id)!.rows.push(row)
  }

  let lastStatementId: string | null = null
  let totalLineCount = 0

  for (const [companyId, { name, rows: companyRows }] of byCompany) {
    const lines = companyRows.map((row) => {
      const clientShare = splitProfileClientShare(row.split_profile)
      const gross = Number(row.gross_earned || 0)
      const netToClient = gross * clientShare
      const distributionFee = gross - netToClient
      return {
        program_name: row.display_title_override || row.program_name,
        platform: row.platform,
        gross,
        client_share_pct: clientShare,
        distributor_share_pct: 1 - clientShare,
        distribution_fee: distributionFee,
        net_to_client: netToClient,
      }
    })

    const grossTotal = lines.reduce((sum, l) => sum + l.gross, 0)
    const feeTotal = lines.reduce((sum, l) => sum + l.distribution_fee, 0)
    const netTotal = lines.reduce((sum, l) => sum + l.net_to_client, 0)

    const { data: statement, error: statementError } = await admin
      .from("statements")
      .insert({
        production_company_id: companyId,
        label: `${name} — ${formatPaymentMonthLabel(paymentMonth)}`,
        payment_month: paymentMonth,
        period_start: new Date(`${paymentMonth}-01`).toISOString().slice(0, 10),
        period_end: new Date(
          Number(paymentMonth.slice(0, 4)),
          Number(paymentMonth.slice(5, 7)),
          0
        )
          .toISOString()
          .slice(0, 10),
        status: "draft",
        gross_total: grossTotal,
        distribution_fee_total: feeTotal,
        net_to_client_total: netTotal,
      })
      .select()
      .single()

    if (statementError || !statement) {
      warnings.push(`Could not create statement for ${name}: ${statementError?.message}`)
      continue
    }

    const { error: linesError } = await admin
      .from("statement_lines")
      .insert(lines.map((l) => ({ ...l, statement_id: statement.statement_id })))

    if (linesError) {
      warnings.push(`Could not save line items for ${name}: ${linesError.message}`)
      continue
    }

    const { error: rowUpdateError } = await admin
      .from("row_assignments")
      .update({ status: "statemented", statement_id: statement.statement_id, payment_month: paymentMonth })
      .in(
        "assignment_id",
        companyRows.map((r) => r.assignment_id)
      )

    if (rowUpdateError) warnings.push(`Rows for ${name} were statemented but not fully synced.`)

    lastStatementId = statement.statement_id
    totalLineCount += lines.length
  }

  if (!lastStatementId) {
    return NextResponse.json({ error: "Statement generation failed.", warnings }, { status: 500 })
  }

  if (byCompany.size > 1) {
    warnings.push(
      `Rows spanned ${byCompany.size} production companies — a separate statement was generated for each; showing the most recent.`
    )
  }

  return NextResponse.json({ statementId: lastStatementId, lineCount: totalLineCount, warnings })
}
