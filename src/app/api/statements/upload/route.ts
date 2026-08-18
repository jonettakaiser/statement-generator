import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server"
import { parseStatementCsv } from "@/lib/statements/csv"

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: 403 })

  const form = await req.formData()
  const file = form.get("file")
  const platform = String(form.get("platform") ?? "").trim()
  const periodStart = String(form.get("periodStart") ?? "")
  const periodEnd = String(form.get("periodEnd") ?? "")

  if (!(file instanceof File) || !platform || !periodStart || !periodEnd) {
    return NextResponse.json({ error: "Missing platform, period, or file." }, { status: 400 })
  }

  const text = await file.text()
  const { rows, errors } = parseStatementCsv(text)
  if (errors.length > 0) {
    return NextResponse.json({ error: "CSV could not be parsed.", details: errors }, { status: 400 })
  }

  const totalGross = rows.reduce((sum, r) => sum + r.grossEarned, 0)
  const admin = createSupabaseAdminClient()

  const { data: upload, error: uploadError } = await admin
    .from("statement_uploads")
    .insert({
      file_name: file.name,
      platform,
      period_start: periodStart,
      period_end: periodEnd,
      status: "assigning",
      total_gross: totalGross,
    })
    .select()
    .single()

  if (uploadError || !upload) {
    return NextResponse.json({ error: uploadError?.message ?? "Upload failed" }, { status: 500 })
  }

  const rowInserts = rows.map((row, index) => ({
    upload_id: upload.upload_id,
    source_row_index: index,
    program_name: row.programName,
    csv_episode: row.episode || null,
    platform,
    gross_earned: row.grossEarned,
    status: "pending" as const,
  }))

  const { error: rowsError } = await admin.from("row_assignments").insert(rowInserts)
  if (rowsError) {
    return NextResponse.json({ error: rowsError.message }, { status: 500 })
  }

  return NextResponse.json({ upload, rowCount: rows.length, totalGross })
}
