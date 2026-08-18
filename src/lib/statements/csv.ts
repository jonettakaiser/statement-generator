export type StatementCsvRow = {
  programName: string
  episode: string
  grossEarned: number
  impressions: number | null
  ecpm: number | null
}

export function normalizeProgramName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function parseCsvLines(text: string): string[][] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""))
}

function toNumber(value: string | undefined): number {
  if (!value) return 0
  const cleaned = value.replace(/[$,]/g, "").trim()
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function toNumberOrNull(value: string | undefined): number | null {
  if (!value || !value.trim()) return null
  const cleaned = value.replace(/[$,]/g, "").trim()
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const EXPECTED_HEADERS = ["program name", "episode", "gross earned", "impressions", "ecpm"]

export function parseStatementCsv(text: string): {
  rows: StatementCsvRow[]
  errors: string[]
} {
  const lines = parseCsvLines(text.trim())
  if (lines.length === 0) {
    return { rows: [], errors: ["The file is empty."] }
  }

  const header = lines[0].map((h) => h.trim().toLowerCase())
  const programIdx = header.indexOf("program name")
  const episodeIdx = header.indexOf("episode")
  const grossIdx = header.indexOf("gross earned")
  const impressionsIdx = header.indexOf("impressions")
  const ecpmIdx = header.indexOf("ecpm")

  const errors: string[] = []
  if (programIdx === -1 || grossIdx === -1) {
    return {
      rows: [],
      errors: [
        `Missing required column(s). Expected headers: ${EXPECTED_HEADERS.join(", ")}.`,
      ],
    }
  }

  const rows: StatementCsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]
    const programName = (cells[programIdx] ?? "").trim()
    if (!programName) {
      errors.push(`Row ${i + 1}: missing program name.`)
      continue
    }
    rows.push({
      programName,
      episode: episodeIdx !== -1 ? (cells[episodeIdx] ?? "").trim() : "",
      grossEarned: toNumber(cells[grossIdx]),
      impressions: impressionsIdx !== -1 ? toNumberOrNull(cells[impressionsIdx]) : null,
      ecpm: ecpmIdx !== -1 ? toNumberOrNull(cells[ecpmIdx]) : null,
    })
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No data rows found.")
  }

  return { rows, errors }
}
