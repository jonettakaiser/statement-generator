import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json()
  const sendEmail = Boolean(body.sendEmail)
  const includePortalUsers = Boolean(body.includePortalUsers)
  const makeVisible = body.makeVisible !== false

  const admin = createSupabaseAdminClient()

  const { data: statement, error: statementError } = await admin
    .from("statements")
    .select("production_company_id, production_companies(name, primary_contact_email)")
    .eq("statement_id", params.id)
    .single()

  if (statementError || !statement) {
    return NextResponse.json({ error: "Statement not found." }, { status: 404 })
  }

  const company = statement as typeof statement & {
    production_companies: { name: string; primary_contact_email: string | null } | null
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

  if (sendEmail && to.length === 0) {
    return NextResponse.json({ error: "No primary contact email on file." }, { status: 400 })
  }

  const { error: updateError } = await admin
    .from("statements")
    .update({
      status: "sent",
      visible_to_client: makeVisible,
      sent_at: new Date().toISOString(),
    })
    .eq("statement_id", params.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  if (sendEmail) {
    // TODO: wire up a real email provider (Resend, SES, etc). For now the
    // send is logged so the publish flow can be exercised end-to-end.
    console.log(
      `[stub email] Statement ${params.id} for ${company.production_companies?.name} -> to: ${to.join(", ")}${cc.length ? `, cc: ${cc.join(", ")}` : ""}`
    )
  }

  return NextResponse.json({ recipients: { to, cc } })
}
