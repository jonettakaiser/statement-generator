import type { SupabaseClient } from "@supabase/supabase-js"
import { BSE_FILM_RULES } from "./bse-film-catalog"
import { normalizeProgramName } from "./csv"

type FilmRow = {
  film_id: string
  title: string
  production_company_id: string | null
  statement_contact_email: string | null
  created_at: string
}

let seedLock: Promise<void> | null = null

export async function ensureBseFilmLibrary(admin: SupabaseClient) {
  if (seedLock) return seedLock
  seedLock = seedBseFilmLibrary(admin).finally(() => {
    seedLock = null
  })
  return seedLock
}

async function seedBseFilmLibrary(admin: SupabaseClient) {
  await dedupeFilmsByNormalizedTitle(admin)

  const { data: existing, error: filmsError } = await admin
    .from("films")
    .select("film_id, title")
  if (filmsError) throw new Error(filmsError.message)

  const byNormalizedTitle = new Map(
    (existing ?? []).map((film) => [normalizeProgramName(film.title), film])
  )

  const missing = BSE_FILM_RULES.filter(
    (rule) => !byNormalizedTitle.has(normalizeProgramName(rule.title))
  ).map((rule) => ({ title: rule.title }))

  for (const row of missing) {
    const { data: film, error: insertError } = await admin
      .from("films")
      .insert(row)
      .select("film_id, title")
      .single()
    if (insertError) {
      const { data: retry } = await admin.from("films").select("film_id, title")
      const match = (retry ?? []).find(
        (item) => normalizeProgramName(item.title) === normalizeProgramName(row.title)
      )
      if (match) {
        byNormalizedTitle.set(normalizeProgramName(match.title), match)
        continue
      }
      throw new Error(insertError.message)
    }
    if (film) byNormalizedTitle.set(normalizeProgramName(film.title), film)
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

async function dedupeFilmsByNormalizedTitle(admin: SupabaseClient) {
  const { data: films, error } = await admin
    .from("films")
    .select("film_id, title, production_company_id, statement_contact_email, created_at")
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)

  const groups = new Map<string, FilmRow[]>()
  for (const film of (films ?? []) as FilmRow[]) {
    const key = normalizeProgramName(film.title)
    if (!key) continue
    const group = groups.get(key) ?? []
    group.push(film)
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue

    const keeper =
      group.find((film) => film.production_company_id) ??
      group.find((film) => film.statement_contact_email) ??
      group[0]
    const extraIds = group
      .filter((film) => film.film_id !== keeper.film_id)
      .map((film) => film.film_id)
    if (extraIds.length === 0) continue

    const donor = group.find(
      (film) => film.film_id !== keeper.film_id && film.production_company_id
    )
    if (!keeper.production_company_id && donor?.production_company_id) {
      const { error: mergeError } = await admin
        .from("films")
        .update({
          production_company_id: donor.production_company_id,
          statement_contact_email:
            keeper.statement_contact_email ?? donor.statement_contact_email,
        })
        .eq("film_id", keeper.film_id)
      if (mergeError) throw new Error(mergeError.message)
    }

    const { error: splitMoveError } = await admin
      .from("program_splits")
      .update({ film_id: keeper.film_id })
      .in("film_id", extraIds)
    if (splitMoveError) throw new Error(splitMoveError.message)

    const { error: rowMoveError } = await admin
      .from("row_assignments")
      .update({ film_id: keeper.film_id })
      .in("film_id", extraIds)
    if (rowMoveError) throw new Error(rowMoveError.message)

    const { error: deleteError } = await admin.from("films").delete().in("film_id", extraIds)
    if (deleteError) throw new Error(deleteError.message)
  }
}
