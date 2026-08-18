import { NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const admin = createSupabaseAdminClient()
  const { data: films, error: filmsError } = await admin
    .from("films")
    .select("film_id, title, statement_contact_email")
    .order("title", { ascending: true })

  if (filmsError) return NextResponse.json({ error: filmsError.message }, { status: 500 })
  return NextResponse.json({ films: films ?? [] })
}
