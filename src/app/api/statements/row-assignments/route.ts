import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"
import { deriveAssignmentStatus } from "@/lib/statements/assignment-status"
import type { ProgramType, SplitProfile } from "@/lib/statements/types"

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const uploadId = req.nextUrl.searchParams.get("uploadId")
  if (!uploadId) return NextResponse.json({ error: "uploadId is required" }, { status: 400 })

  const admin = createSupabaseAdminClient()

  const [{ data: upload, error: uploadError }, { data: rows, error: rowsError }] = await Promise.all([
    admin.from("statement_uploads").select("*").eq("upload_id", uploadId).single(),
    admin
      .from("row_assignments")
      .select("*, films(title)")
      .eq("upload_id", uploadId)
      .order("source_row_index", { ascending: true }),
  ])

  if (uploadError || !upload) return NextResponse.json({ error: "Upload not found." }, { status: 404 })
  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 })

  const assignments = (rows ?? []).map((row) => {
    const { films, ...rest } = row as typeof row & { films: { title: string } | null }
    return { ...rest, film_title: films?.title ?? null }
  })

  return NextResponse.json({ assignments, upload })
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const body = await req.json()
  const patches = Array.isArray(body.assignments) ? body.assignments : []
  if (patches.length === 0) {
    return NextResponse.json({ error: "No assignments provided." }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const updated: Record<string, unknown>[] = []
  const errors: string[] = []

  for (const patch of patches) {
    const {
      assignmentId,
      filmId,
      splitProfile,
      programType,
      seasonName,
      episodeName,
      displayTitleOverride,
    } = patch as {
      assignmentId: string
      filmId: string
      splitProfile: SplitProfile
      programType: ProgramType
      seasonName: string | null
      episodeName: string | null
      displayTitleOverride: string | null
    }

    const status = deriveAssignmentStatus({
      filmId,
      splitProfile,
      programType,
      episodeName: episodeName ?? "",
    })

    // Statemented rows are locked — a generated statement already snapshot
    // their values, so further edits here would silently diverge from it.
    const { data, error: updateError } = await admin
      .from("row_assignments")
      .update({
        film_id: filmId,
        split_profile: splitProfile,
        program_type: programType,
        season_name: seasonName,
        episode_name: episodeName,
        display_title_override: displayTitleOverride,
        status,
      })
      .eq("assignment_id", assignmentId)
      .neq("status", "statemented")
      .select()

    if (updateError) {
      errors.push(updateError.message)
      continue
    }
    if (data) updated.push(...data)
  }

  if (updated.length === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 500 })
  }

  return NextResponse.json({ updated: updated.length, assignments: updated, errors })
}
