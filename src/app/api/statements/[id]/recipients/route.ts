import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const includePortalUsers = req.nextUrl.searchParams.get("includePortalUsers") === "true"
  const admin = createSupabaseAdminClient()

  const { data: statement, error: statementError } = await admin
    .from("statements")
    .select("production_company_id, production_companies(primary_contact_email)")
    .eq("statement_id", params.id)
    .single()

  if (statementError || !statement) {
    return NextResponse.json({ error: "Statement not found." }, { status: 404 })
  }

  const company = statement as typeof statement & {
    production_companies: { primary_contact_email: string | null } | null
  }

  const to = company.production_companies?.primary_contact_email
    ? [company.production_companies.primary_contact_email]
    : []

  let cc: string[] = []
  if (includePortalUsers) {
    const { data: portalUsers } = await admin
      .from("users")
      .select("email")
      .eq("production_company_id", statement.production_company_id)
      .eq("role", "client")

    cc = (portalUsers ?? [])
      .map((u) => u.email)
      .filter((email): email is string => Boolean(email) && !to.includes(email))
  }

  return NextResponse.json({ recipients: { to, cc } })
}
