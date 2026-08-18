import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const admin = createSupabaseAdminClient()

  const [{ data: uploads, error: uploadsError }, { data: statements, error: statementsError }] =
    await Promise.all([
      admin
        .from("statement_uploads")
        .select("*, row_assignments(program_name)")
        .order("created_at", { ascending: false }),
      admin.from("statements").select("*").order("created_at", { ascending: false }),
    ])

  if (uploadsError) return NextResponse.json({ error: uploadsError.message }, { status: 500 })
  if (statementsError) return NextResponse.json({ error: statementsError.message }, { status: 500 })

  type UploadWithRows = Record<string, unknown> & {
    row_assignments: { program_name: string }[]
  }

  const shapedUploads = ((uploads ?? []) as unknown as UploadWithRows[]).map((u) => {
    const { row_assignments, ...rest } = u
    const programNames = Array.from(new Set(row_assignments.map((r) => r.program_name)))
    return { ...rest, program_names: programNames }
  })

  return NextResponse.json({ uploads: shapedUploads, statements: statements ?? [] })
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const uploadId = req.nextUrl.searchParams.get("uploadId")
  if (!uploadId) return NextResponse.json({ error: "uploadId is required" }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { error: deleteError } = await admin
    .from("statement_uploads")
    .delete()
    .eq("upload_id", uploadId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
