export type ProgramType = "feature" | "series"

export type RowAssignmentStatus = "pending" | "ready" | "statemented"

// Client / distributor revenue splits. The percentage is the client's
// (production company's) share; the remainder is the distribution fee.
export const SPLIT_PROFILES = [
  "client-50",
  "client-60",
  "client-70",
  "client-80",
  "client-90",
] as const

export type SplitProfile = (typeof SPLIT_PROFILES)[number]

export const SPLIT_PROFILE_CLIENT_SHARE: Record<SplitProfile, number> = {
  "client-50": 0.5,
  "client-60": 0.6,
  "client-70": 0.7,
  "client-80": 0.8,
  "client-90": 0.9,
}
