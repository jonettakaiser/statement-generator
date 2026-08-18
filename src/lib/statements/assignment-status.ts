import type { ProgramType, RowAssignmentStatus, SplitProfile } from "./types"

export function deriveAssignmentStatus(input: {
  filmId: string | null
  splitProfile: SplitProfile | null
  programType: ProgramType
  episodeName: string
}): RowAssignmentStatus {
  if (!input.filmId || !input.splitProfile) return "pending"
  if (input.programType === "series" && !input.episodeName.trim()) return "pending"
  return "ready"
}
