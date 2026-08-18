import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const admin = createSupabaseAdminClient()
  const { data: companies, error: companiesError } = await admin
    .from("production_companies")
    .select("id, name, primary_contact_email")
    .order("name", { ascending: true })

  if (companiesError) return NextResponse.json({ error: companiesError.message }, { status: 500 })
  return NextResponse.json({ companies: companies ?? [] })
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? "").trim()
  const primaryContactEmail = String(body.primaryContactEmail ?? "").trim() || null
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { data: existing } = await admin
    .from("production_companies")
    .select("id, name, primary_contact_email")
    .ilike("name", name)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ company: existing, created: false })
  }

  const { data: company, error: insertError } = await admin
    .from("production_companies")
    .insert({ name, primary_contact_email: primaryContactEmail })
    .select("id, name, primary_contact_email")
    .single()

  if (insertError || !company) {
    return NextResponse.json(
      { error: insertError?.message ?? "Could not create production company." },
      { status: 500 }
    )
  }

  return NextResponse.json({ company, created: true })
}
