import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"
import { splitProfileClientShare, splitProfileLabel } from "@/lib/statements/splits"
import { ensureBseFilmLibrary } from "@/lib/statements/seed-bse-library"
import type { SplitProfile } from "@/lib/statements/types"

type RowWithFilm = {
  assignment_id: string
  program_name: string
  platform: string
  split_profile: SplitProfile
  gross_earned: number
  status: string
  statement_id: string | null
  program_type: string
  season_name: string | null
  episode_name: string | null
  films: {
    film_id: string
    title: string
    production_company_id: string | null
    production_companies: { id: string; name: string } | null
  } | null
  statement_uploads: { period_start: string; period_end: string } | null
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const paymentMonth = req.nextUrl.searchParams.get("paymentMonth")
  if (!paymentMonth) return NextResponse.json({ error: "paymentMonth is required" }, { status: 400 })

  const admin = createSupabaseAdminClient()
  try {
    await ensureBseFilmLibrary(admin)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to prepare film library." },
      { status: 500 }
    )
  }

  const { data: statementedForMonth } = await admin
    .from("statements")
    .select("statement_id")
    .eq("payment_month", paymentMonth)

  const statementIdsForMonth = (statementedForMonth ?? []).map((s) => s.statement_id)

  const { data: rows, error: rowsError } = await admin
    .from("row_assignments")
    .select(
      "assignment_id, program_name, platform, split_profile, gross_earned, status, statement_id, program_type, season_name, episode_name, films(film_id, title, production_company_id, production_companies(id, name)), statement_uploads(period_start, period_end)"
    )
    .in(
      "status",
      statementIdsForMonth.length > 0 ? ["ready", "statemented"] : ["ready"]
    )
    .not("film_id", "is", null)

  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 })

  const relevant = (rows ?? []).filter(
    (r) => r.status === "ready" || (r.statement_id && statementIdsForMonth.includes(r.statement_id))
  ) as unknown as RowWithFilm[]

  const byCompany = new Map<
    string,
    { production_company_id: string; company_name: string; items: ReturnType<typeof toItem>[] }
  >()

  function toItem(row: RowWithFilm) {
    const gross = Number(row.gross_earned || 0)
    const clientShare = splitProfileClientShare(row.split_profile)
    return {
      assignment_id: row.assignment_id,
      program_name: row.program_name,
      film_title: row.films?.title ?? null,
      platform: row.platform,
      split_profile: row.split_profile,
      split_label: splitProfileLabel(row.split_profile),
      gross: gross * clientShare,
      status: row.status,
      statement_id: row.statement_id,
      program_type: row.program_type,
      season_name: row.season_name,
      episode_name: row.episode_name,
      period_start: row.statement_uploads?.period_start ?? null,
      period_end: row.statement_uploads?.period_end ?? null,
    }
  }

  for (const row of relevant) {
    const company = row.films?.production_companies
    if (!company) continue
    if (!byCompany.has(company.id)) {
      byCompany.set(company.id, {
        production_company_id: company.id,
        company_name: company.name,
        items: [],
      })
    }
    byCompany.get(company.id)!.items.push(toItem(row))
  }

  return NextResponse.json({ companies: Array.from(byCompany.values()) })
}
