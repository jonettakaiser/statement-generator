import type { SupabaseClient } from "@supabase/supabase-js"
import { BSE_FILM_RULES } from "./bse-film-catalog"
import { normalizeProgramName } from "./csv"

export async function ensureBseFilmLibrary(admin: SupabaseClient) {
  const { data: existing, error: filmsError } = await admin.from("films").select("film_id, title")
  if (filmsError) throw new Error(filmsError.message)

  const byNormalizedTitle = new Map(
    (existing ?? []).map((film) => [normalizeProgramName(film.title), film])
  )

  const missing = BSE_FILM_RULES.filter(
    (rule) => !byNormalizedTitle.has(normalizeProgramName(rule.title))
  ).map((rule) => ({ title: rule.title }))

  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await admin
      .from("films")
      .insert(missing)
      .select("film_id, title")
    if (insertError) throw new Error(insertError.message)
    for (const film of inserted ?? []) {
      byNormalizedTitle.set(normalizeProgramName(film.title), film)
    }
  }

  const splitRows = []
  for (const rule of BSE_FILM_RULES) {
    if (!rule.splitProfile) continue
    const film = byNormalizedTitle.get(normalizeProgramName(rule.title))
    if (!film) continue

    const names = [rule.title, ...rule.aliases]
    const seen = new Set<string>()
    for (const name of names) {
      const normalized = normalizeProgramName(name)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      splitRows.push({
        program_name: name,
        program_name_normalized: normalized,
        film_id: film.film_id,
        split_profile: rule.splitProfile,
        program_type: "feature",
      })
    }
  }

  const { data: existingSplits, error: existingSplitsError } = await admin
    .from("program_splits")
    .select("program_name_normalized")
  if (existingSplitsError) throw new Error(existingSplitsError.message)

  const existingNormalized = new Set(
    (existingSplits ?? []).map((row) => row.program_name_normalized)
  )
  const newSplitRows = splitRows.filter(
    (row) => !existingNormalized.has(row.program_name_normalized)
  )

  if (newSplitRows.length > 0) {
    const { error: splitError } = await admin.from("program_splits").insert(newSplitRows)
    if (splitError) throw new Error(splitError.message)
  }
}
