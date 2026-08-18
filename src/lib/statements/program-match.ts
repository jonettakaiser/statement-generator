import { findBseFilm, splitProfileForFilmName } from "./bse-film-catalog"
import { normalizeProgramName } from "./csv"
import type { ProgramType, SplitProfile } from "./types"

type FilmLike = { film_id: string; title: string }

type ProgramSplitMatch = {
  film_id: string | null
  program_name_normalized: string
  split_profile: SplitProfile
  program_type?: ProgramType | null
  season_name?: string | null
  episode_name?: string | null
  display_title_override?: string | null
}

export function resolveFilmIdForCsvProgram(
  programName: string,
  films: FilmLike[],
  splitMatches: ProgramSplitMatch[]
): string | null {
  const normalized = normalizeProgramName(programName)
  if (!normalized) return null

  const savedMatch = splitMatches.find(
    (m) => m.film_id && m.program_name_normalized === normalized
  )
  if (savedMatch?.film_id) return savedMatch.film_id

  const filmMatch = films.find((f) => normalizeProgramName(f.title) === normalized)
  if (filmMatch) return filmMatch.film_id

  const catalog = findBseFilm(programName)
  if (!catalog) return null
  const catalogFilm = films.find(
    (f) => normalizeProgramName(f.title) === normalizeProgramName(catalog.title)
  )
  return catalogFilm?.film_id ?? null
}

export function rowEditFromMatch(
  filmId: string,
  fallback: {
    split_profile: SplitProfile | null
    program_type: ProgramType
    season_name: string | null
    episode_name?: string | null
    display_title_override: string | null
  },
  splitMatches: ProgramSplitMatch[],
  filmTitle?: string | null
) {
  const saved = splitMatches.find((m) => m.film_id === filmId)
  const catalogSplit = filmTitle ? splitProfileForFilmName(filmTitle) : null
  return {
    filmId,
    splitProfile: saved?.split_profile ?? fallback.split_profile ?? catalogSplit ?? "",
    programType: (saved?.program_type as ProgramType) || fallback.program_type,
    seasonName: saved?.season_name ?? fallback.season_name ?? "",
    episodeName: saved?.episode_name ?? fallback.episode_name ?? "",
    displayTitleOverride: saved?.display_title_override ?? fallback.display_title_override ?? "",
  }
}
