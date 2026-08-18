import { NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const admin = createSupabaseAdminClient()

  const { data: statement, error: statementError } = await admin
    .from("statements")
    .select("*, production_companies(name)")
    .eq("statement_id", params.id)
    .single()

  if (statementError || !statement) {
    return NextResponse.json({ error: "Statement not found." }, { status: 404 })
  }

  const { data: lines, error: linesError } = await admin
    .from("statement_lines")
    .select("*")
    .eq("statement_id", params.id)
    .order("program_name", { ascending: true })

  if (linesError) return NextResponse.json({ error: linesError.message }, { status: 500 })

  const { production_companies, ...statementRest } = statement as typeof statement & {
    production_companies: { name: string } | null
  }

  return NextResponse.json({
    statement: statementRest,
    lines: lines ?? [],
    productionCompanyName: production_companies?.name ?? null,
  })
}
