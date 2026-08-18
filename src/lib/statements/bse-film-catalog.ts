import { normalizeProgramName } from "./csv"
import type { SplitProfile } from "./types"

export type BseFilmRule = {
  title: string
  aliases: string[]
  /** Client share of platform gross vs BSE distribution fee. Null = no distro deal on the sheet. */
  splitProfile: SplitProfile | null
  recoup: number | null
}

/**
 * Split rules from BSE Movie Points.xlsx.
 *
 * Distro % is mapped to the statement client/distributor split:
 * - "90% distro" / "Tonja 90%" → client keeps 90%
 * - "80% distro" / "Earl 80%" as the headline distro → client keeps 80%
 * - "10% Distro" / "15% Distro" / "20% Distro" as a fee → client keeps 90/85/80
 * - "50/50 split w/BSE & Calientay" → 50/50
 *
 * Net/points (Earl 15% for life after recoup, etc.) are investor waterfalls,
 * not the platform gross split used on statements.
 */
export const BSE_FILM_RULES: BseFilmRule[] = [
  {
    title: "The Bachelorette Party",
    aliases: ["Bachelotte Party"],
    splitProfile: null,
    recoup: 48795.43,
  },
  {
    title: "Warrior Pride",
    aliases: ["BTG QTRLY PYMNTS", "BTG"],
    splitProfile: null,
    recoup: 42714.14,
  },
  {
    title: "Beautiful Rage",
    aliases: ["BRTBOD"],
    splitProfile: null,
    recoup: 37740.97,
  },
  {
    title: "Come Back Home",
    aliases: ["CBH"],
    splitProfile: null,
    recoup: 50303,
  },
  {
    title: "Cold Feet",
    aliases: [],
    splitProfile: "client-90",
    recoup: 47725.48,
  },
  {
    title: "Dangerously In Love",
    aliases: ["DIL"],
    splitProfile: "client-90",
    recoup: 47880.74,
  },
  {
    title: "Dear Future Husband",
    aliases: ["DFH", "DEAR FUTURE HUSBAND PAYMENTS"],
    splitProfile: null,
    recoup: 34310,
  },
  {
    title: "Don't Play In My Face",
    aliases: ["DPIMF"],
    splitProfile: "client-90",
    recoup: 49095.55,
  },
  {
    title: "Egregious",
    aliases: [],
    splitProfile: "client-80",
    recoup: 44393.55,
  },
  {
    title: "Father Dearest",
    aliases: [],
    splitProfile: null,
    recoup: 40182.35,
  },
  {
    title: "God Forgives I Don't",
    aliases: ["GFID"],
    splitProfile: null,
    recoup: 31170.33,
  },
  {
    title: "Gotcha!",
    aliases: ["GOTCHA!"],
    splitProfile: null,
    recoup: 24163.28,
  },
  {
    title: "Heart of a Woman",
    aliases: ["HOAW"],
    splitProfile: "client-80",
    recoup: 52077.66,
  },
  {
    title: "I'm In Love With a Stripper",
    aliases: ["IIWAS", "I'M IN LOVE WITH A STRIPPER"],
    splitProfile: "client-90",
    recoup: 41000,
  },
  {
    title: "IMSK",
    aliases: ["IMSK PAYMENTS"],
    splitProfile: "client-50",
    recoup: 4000,
  },
  {
    title: "Missing",
    aliases: [],
    splitProfile: "client-90",
    recoup: 38376.77,
  },
  {
    title: "One Night Stand",
    aliases: [],
    splitProfile: "client-80",
    recoup: 49394.56,
  },
  {
    title: "Right Man Wrong Woman",
    aliases: ["RMWW"],
    splitProfile: "client-90",
    recoup: 42496.28,
  },
  {
    title: "Sons of a Preacher",
    aliases: ["SOAP"],
    splitProfile: null,
    recoup: 41491.16,
  },
  {
    title: "Street Code Broken",
    aliases: ["SCB"],
    splitProfile: null,
    recoup: 33832,
  },
  {
    title: "Street Code Broken 2",
    aliases: ["SCB2"],
    splitProfile: null,
    recoup: 38832.79,
  },
  {
    title: "Surprise",
    aliases: ["SURPRISE"],
    splitProfile: null,
    recoup: 43659.72,
  },
  {
    title: "Surprise 2",
    aliases: [],
    splitProfile: null,
    recoup: 37164.62,
  },
  {
    title: "Surprise 3",
    aliases: [],
    splitProfile: null,
    recoup: 50745.98,
  },
  {
    title: "Swallow: The Kiss of Death",
    aliases: ["STKOD"],
    splitProfile: null,
    recoup: 36895.77,
  },
  {
    title: "Ten Toes Down",
    aliases: ["TTD"],
    splitProfile: "client-85",
    recoup: 35359.4,
  },
  {
    title: "Ten Toes Down 2",
    aliases: ["TTD2"],
    splitProfile: "client-90",
    recoup: 41819.91,
  },
  {
    title: "The Deceitful Wife",
    aliases: ["TDW"],
    splitProfile: null,
    recoup: 24061,
  },
  {
    title: "The Deceitful Wife 2",
    aliases: ["TDW2"],
    splitProfile: null,
    recoup: 37365.22,
  },
  {
    title: "The Landlord",
    aliases: ["TLL"],
    splitProfile: "client-85",
    recoup: 34961.01,
  },
  {
    title: "The One Next Door",
    aliases: ["TOND"],
    splitProfile: "client-90",
    recoup: 41235.74,
  },
  {
    title: "Too Messy",
    aliases: [],
    splitProfile: "client-90",
    recoup: 41613.79,
  },
  {
    title: "The Perfect Babysitter",
    aliases: ["TPB"],
    splitProfile: "client-80",
    recoup: 39755.07,
  },
  {
    title: "TOC",
    aliases: ["TOC PAYMENTS"],
    splitProfile: null,
    recoup: 38400,
  },
  {
    title: "Ultimate Vendetta",
    aliases: ["TUV"],
    splitProfile: "client-80",
    recoup: 38868.76,
  },
  {
    title: "The Wedding Planner",
    aliases: ["TWP"],
    splitProfile: null,
    recoup: 55870.55,
  },
  {
    title: "Unconnected",
    aliases: [],
    splitProfile: null,
    recoup: 45298.88,
  },
  {
    title: "Woman to Woman",
    aliases: ["W2W"],
    splitProfile: "client-90",
    recoup: 47558.7,
  },
  {
    title: "Zugg Island / What Lies Within",
    aliases: ["Zugg Island-WLW", "Zugg Island", "What Lies Within"],
    splitProfile: "client-85",
    recoup: 17986,
  },
]

const catalogByNormalizedName = (() => {
  const map = new Map<string, BseFilmRule>()
  for (const film of BSE_FILM_RULES) {
    map.set(normalizeProgramName(film.title), film)
    for (const alias of film.aliases) {
      map.set(normalizeProgramName(alias), film)
    }
  }
  return map
})()

export function findBseFilm(name: string): BseFilmRule | undefined {
  const normalized = normalizeProgramName(name)
  if (!normalized) return undefined
  return catalogByNormalizedName.get(normalized)
}

export function splitProfileForFilmName(name: string): SplitProfile | null {
  return findBseFilm(name)?.splitProfile ?? null
}

export function bseFilmSearchHaystack(title: string): string {
  const film = findBseFilm(title)
  if (!film) return title
  return [film.title, ...film.aliases].join(" ")
}
