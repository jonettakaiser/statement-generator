import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"
import { ensureBseFilmLibrary } from "@/lib/statements/seed-bse-library"
import { normalizeProgramName, uniqueByNormalizedTitle } from "@/lib/statements/csv"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const admin = createSupabaseAdminClient()
  try {
    await ensureBseFilmLibrary(admin)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to seed film library." },
      { status: 500 }
    )
  }

  const { data: films, error: filmsError } = await admin
    .from("films")
    .select("film_id, title, statement_contact_email, production_company_id")
    .order("title", { ascending: true })

  if (filmsError) return NextResponse.json({ error: filmsError.message }, { status: 500 })
  return NextResponse.json({ films: uniqueByNormalizedTitle(films ?? []) })
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const title = String(body.title ?? "").trim()
  if (!title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const normalized = normalizeProgramName(title)
  const { data: existing, error: existingError } = await admin
    .from("films")
    .select("film_id, title, statement_contact_email, production_company_id")
    .order("title", { ascending: true })

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

  const match = (existing ?? []).find((film) => normalizeProgramName(film.title) === normalized)
  if (match) {
    return NextResponse.json({ film: match, created: false })
  }

  const { data: film, error: insertError } = await admin
    .from("films")
    .insert({ title })
    .select("film_id, title, statement_contact_email, production_company_id")
    .single()

  if (insertError || !film) {
    return NextResponse.json({ error: insertError?.message ?? "Could not create program." }, { status: 500 })
  }

  return NextResponse.json({ film, created: true })
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const filmId = String(body.filmId ?? "").trim()
  const productionCompanyId = String(body.productionCompanyId ?? "").trim()
  if (!filmId || !productionCompanyId) {
    return NextResponse.json({ error: "filmId and productionCompanyId are required." }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { data: film, error: updateError } = await admin
    .from("films")
    .update({ production_company_id: productionCompanyId })
    .eq("film_id", filmId)
    .select("film_id, title, statement_contact_email, production_company_id")
    .single()

  if (updateError || !film) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not assign production company." },
      { status: 500 }
    )
  }

  return NextResponse.json({ film })
}
