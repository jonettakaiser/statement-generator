import { SPLIT_PROFILE_CLIENT_SHARE, type SplitProfile } from "./types"

export function splitProfileLabel(profile: SplitProfile): string {
  const clientPct = Math.round(SPLIT_PROFILE_CLIENT_SHARE[profile] * 100)
  return `${clientPct}/${100 - clientPct} client/distributor`
}

export function splitProfileClientShare(profile: SplitProfile): number {
  return SPLIT_PROFILE_CLIENT_SHARE[profile]
}
