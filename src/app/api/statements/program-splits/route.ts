import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"
import { normalizeProgramName } from "@/lib/statements/csv"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const admin = createSupabaseAdminClient()
  const { data: splits, error: splitsError } = await admin
    .from("program_splits")
    .select("*")
    .order("program_name", { ascending: true })

  if (splitsError) return NextResponse.json({ error: splitsError.message }, { status: 500 })
  return NextResponse.json({ splits: splits ?? [] })
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json()
  const { filmId, splitProfile, programType, seasonName, episodeName, displayTitleOverride } = body

  if (!filmId || !splitProfile) {
    return NextResponse.json({ error: "filmId and splitProfile are required." }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { data: film, error: filmError } = await admin
    .from("films")
    .select("title")
    .eq("film_id", filmId)
    .single()

  if (filmError || !film) {
    return NextResponse.json({ error: "Film not found." }, { status: 404 })
  }

  const { data: split, error: upsertError } = await admin
    .from("program_splits")
    .upsert(
      {
        program_name: film.title,
        program_name_normalized: normalizeProgramName(film.title),
        film_id: filmId,
        split_profile: splitProfile,
        program_type: programType ?? "feature",
        season_name: seasonName ?? null,
        episode_name: episodeName ?? null,
        display_title_override: displayTitleOverride ?? null,
      },
      { onConflict: "program_name_normalized" }
    )
    .select()
    .single()

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })
  return NextResponse.json({ split })
}
