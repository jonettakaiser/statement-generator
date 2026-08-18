"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  Plus,
  RefreshCw,
  FileText,
  Download,
  Mail,
  Trash2,
  Search,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { ToastAction } from "@/components/ui/toast"
import { StatementView } from "@/components/statement-view"
import { ProgramFilmPicker } from "@/components/program-film-picker"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase-client"
import { normalizeProgramName, parseStatementCsv, uniqueByNormalizedTitle } from "@/lib/statements/csv"
import { deriveAssignmentStatus } from "@/lib/statements/assignment-status"
import { formatPaymentMonthLabel } from "@/lib/statements/payment-month"
import { rowEditFromMatch, resolveFilmIdForCsvProgram } from "@/lib/statements/program-match"
import { splitProfileLabel, splitProfileShortLabel } from "@/lib/statements/splits"
import { printStatement } from "@/lib/print-statement"
import type { ProgramType, RowAssignmentStatus, SplitProfile } from "@/lib/statements/types"
import { SPLIT_PROFILES } from "@/lib/statements/types"
import { splitProfileForFilmName, findBseFilm } from "@/lib/statements/bse-film-catalog"

const PLATFORM_OPTIONS = [
  "Tubi",
  "Amazon Prime Video",
  "YouTube",
  "The Roku Channel",
  "Apple TV",
  "Fawesome TV",
  "Filmzie",
  "fuboTV",
  "Fandango at Home",
]
const CUSTOM_PLATFORM_OPTION = "__other__"

const SPLIT_PROFILE_OPTIONS = SPLIT_PROFILES

type RowAssignment = {
  assignment_id: string
  upload_id: string
  source_row_index: number
  program_name: string
  film_id: string | null
  platform: string
  payment_month: string | null
  split_profile: SplitProfile | null
  program_type: ProgramType
  season_name: string | null
  episode_name: string | null
  display_title_override: string | null
  status: RowAssignmentStatus
  statement_id: string | null
  csv_episode?: string | null
  gross_earned?: number
  film_title?: string | null
}

type RowEdit = {
  filmId: string
  splitProfile: SplitProfile | ""
  programType: ProgramType
  seasonName: string
  episodeName: string
  displayTitleOverride: string
}

type ReadyQueueItem = {
  assignment_id: string
  program_name: string
  film_title: string | null
  platform: string
  split_profile: SplitProfile
  split_label: string
  gross: number
  status: string
  statement_id: string | null
  program_type: string
  season_name: string | null
  episode_name: string | null
  period_start: string | null
  period_end: string | null
}

type ReadyQueueCompany = {
  production_company_id: string
  company_name: string
  items: ReadyQueueItem[]
}

type StatementUpload = {
  upload_id: string
  file_name: string
  platform: string
  film_id: string | null
  payment_month: string | null
  period_start: string
  period_end: string
  status: string
  total_gross: number
  created_at: string
  program_names?: string[]
}

type CsvPreviewProgram = {
  name: string
  inLibrary: boolean
}

type StatementSummary = {
  statement_id: string
  label: string
  payment_month?: string | null
  period_start: string
  period_end: string
  status: string
  gross_total: number
  distribution_fee_total: number
  net_to_client_total: number
  created_at: string
  meta?: { programName?: string; displayProgramName?: string }
}

type StatementLine = {
  line_id: string
  program_name: string
  platform: string
  gross: number
  client_share_pct: number
  distributor_share_pct: number
  distribution_fee: number
  net_to_client: number
}

type ProgramSplit = {
  program_split_id: string
  program_name: string
  program_name_normalized?: string
  film_id: string | null
  split_profile: SplitProfile
  display_title_override: string | null
  program_type?: ProgramType | null
  season_name?: string | null
  episode_name?: string | null
}

function toProgramSplitMatches(splits: ProgramSplit[]) {
  return splits.map((split) => ({
    film_id: split.film_id,
    program_name_normalized:
      split.program_name_normalized ?? normalizeProgramName(split.program_name),
    split_profile: split.split_profile,
    program_type: split.program_type,
    season_name: split.season_name,
    episode_name: split.episode_name,
    display_title_override: split.display_title_override,
  }))
}

type GroupedProgramDefault = {
  key: string
  title: string
  aliases: string[]
  split_profile: SplitProfile
  program_type: ProgramType
  season_name: string | null
  episode_name: string | null
}

function groupProgramDefaults(
  splits: ProgramSplit[],
  filmTitleById: Map<string, string>
): GroupedProgramDefault[] {
  const groups = new Map<string, ProgramSplit[]>()
  for (const split of splits) {
    const key = split.film_id || normalizeProgramName(split.program_name)
    const rows = groups.get(key) ?? []
    rows.push(split)
    groups.set(key, rows)
  }

  return [...groups.entries()]
    .map(([key, rows]) => {
      const filmTitle = rows[0].film_id ? filmTitleById.get(rows[0].film_id) : null
      const title =
        filmTitle ||
        [...rows].sort((a, b) => b.program_name.length - a.program_name.length)[0].program_name
      const titleKey = normalizeProgramName(title)
      const aliases = [
        ...new Set(
          rows
            .map((row) => row.program_name)
            .filter((name) => normalizeProgramName(name) !== titleKey)
        ),
      ].sort((a, b) => a.localeCompare(b))

      return {
        key,
        title,
        aliases,
        split_profile: rows[0].split_profile,
        program_type: (rows[0].program_type as ProgramType) || "feature",
        season_name: rows[0].season_name ?? null,
        episode_name: rows[0].episode_name ?? null,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

type FilmOption = {
  film_id: string
  title: string
  statement_contact_email: string | null
  production_company_id: string | null
}

type ProductionCompanyOption = {
  id: string
  name: string
  primary_contact_email: string | null
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n ?? 0)
}

function formatDate(d: string) {
  if (!d) return "—"
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function displayRowStatus(row: RowAssignment, edit: RowEdit): RowAssignmentStatus {
  if (row.status === "statemented") return "statemented"
  return deriveAssignmentStatus({
    filmId: edit.filmId || null,
    splitProfile: edit.splitProfile || null,
    programType: edit.programType,
    episodeName: edit.episodeName,
  })
}

function canSaveProgramDefault(edit: RowEdit): boolean {
  if (!edit.filmId || !edit.splitProfile) return false
  if (edit.programType === "series" && !edit.episodeName.trim()) return false
  return true
}

function editMatchesSavedDefault(edit: RowEdit, saved: ProgramSplit | undefined): boolean {
  if (!saved?.film_id || edit.filmId !== saved.film_id) return false
  return (
    edit.splitProfile === saved.split_profile &&
    edit.programType === (saved.program_type || "feature") &&
    (edit.seasonName.trim() || null) === (saved.season_name?.trim() || null) &&
    (edit.episodeName.trim() || null) === (saved.episode_name?.trim() || null) &&
    (edit.displayTitleOverride.trim() || null) === (saved.display_title_override?.trim() || null)
  )
}

function mapApiRowAssignment(raw: Record<string, unknown>): RowAssignment {
  return {
    assignment_id: String(raw.assignment_id ?? ""),
    upload_id: String(raw.upload_id ?? ""),
    source_row_index: Number(raw.source_row_index ?? 0),
    program_name: String(raw.program_name ?? ""),
    film_id: raw.film_id ? String(raw.film_id) : null,
    platform: String(raw.platform ?? ""),
    payment_month: raw.payment_month ? String(raw.payment_month) : null,
    split_profile: raw.split_profile ? (raw.split_profile as SplitProfile) : null,
    program_type: raw.program_type === "series" ? "series" : "feature",
    season_name: raw.season_name ? String(raw.season_name) : null,
    episode_name: raw.episode_name ? String(raw.episode_name) : null,
    display_title_override: raw.display_title_override
      ? String(raw.display_title_override)
      : null,
    status: (raw.status as RowAssignmentStatus) ?? "pending",
    statement_id: raw.statement_id ? String(raw.statement_id) : null,
    csv_episode: raw.csv_episode ? String(raw.csv_episode) : null,
    gross_earned: Number(raw.gross_earned ?? 0),
    film_title: raw.film_title ? String(raw.film_title) : null,
  }
}

function rowMatchesAssignmentSearch(
  row: RowAssignment,
  query: string,
  edit: RowEdit | undefined,
  filmTitleById: Map<string, string>
): boolean {
  const selectedTitle = edit?.filmId ? filmTitleById.get(edit.filmId) ?? "" : ""
  const normalizedQuery = normalizeProgramName(query)
  const fields = [
    row.program_name,
    row.film_title ?? "",
    selectedTitle,
    row.platform,
    row.status,
    edit?.splitProfile ? splitProfileLabel(edit.splitProfile) : "",
  ]

  return fields.some((field) => {
    const value = field.trim()
    if (!value) return false
    const lower = value.toLowerCase()
    return lower.includes(query) || normalizeProgramName(value).includes(normalizedQuery)
  })
}

function applyAutoMatchToEdits(
  assignments: RowAssignment[],
  edits: Record<string, RowEdit>,
  films: FilmOption[],
  programSplits: ProgramSplit[]
): Record<string, RowEdit> {
  const splitMatches = toProgramSplitMatches(programSplits)
  const next = { ...edits }

  for (const row of assignments) {
    if (row.status === "statemented") continue

    const current = next[row.assignment_id]
    if (current?.filmId && current.splitProfile) continue

    const matchedFilmId =
      row.film_id || resolveFilmIdForCsvProgram(row.program_name, films, splitMatches)

    if (!matchedFilmId) continue

    const matchedTitle =
      films.find((f) => f.film_id === matchedFilmId)?.title ?? row.program_name
    const matched = rowEditFromMatch(
      matchedFilmId,
      {
        split_profile: current?.splitProfile || null,
        program_type: current?.programType ?? row.program_type,
        season_name: current?.seasonName ?? row.season_name,
        episode_name: current?.episodeName ?? row.episode_name ?? row.csv_episode,
        display_title_override:
          current?.displayTitleOverride ?? row.display_title_override,
      },
      splitMatches,
      matchedTitle
    )
    next[row.assignment_id] = {
      ...matched,
      splitProfile: (matched.splitProfile || "") as SplitProfile | "",
    }
  }

  return next
}

const ROWS_PER_PAGE = 50

export default function StatementsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const [uploads, setUploads] = useState<StatementUpload[]>([])
  const [statements, setStatements] = useState<StatementSummary[]>([])
  const [programSplits, setProgramSplits] = useState<ProgramSplit[]>([])

  const [platform, setPlatform] = useState("")
  const [customPlatform, setCustomPlatform] = useState("")
  const [uploadPeriodStart, setUploadPeriodStart] = useState("")
  const [uploadPeriodEnd, setUploadPeriodEnd] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvInputKey, setCsvInputKey] = useState(0)
  const [csvPreviewPrograms, setCsvPreviewPrograms] = useState<CsvPreviewProgram[]>([])
  const [csvPreviewError, setCsvPreviewError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null)
  const [activeUploadMeta, setActiveUploadMeta] = useState<{
    file_name: string
    platform: string
    payment_month: string | null
    period_start: string
    period_end: string
  } | null>(null)

  const [rowAssignments, setRowAssignments] = useState<RowAssignment[]>([])
  const [rowEdits, setRowEdits] = useState<Record<string, RowEdit>>({})
  const [assignmentSearch, setAssignmentSearch] = useState("")
  const [defaultsSearch, setDefaultsSearch] = useState("")
  const [assignmentPage, setAssignmentPage] = useState(0)
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
  const [isSavingAssignments, setIsSavingAssignments] = useState(false)
  const [savingDefaultForId, setSavingDefaultForId] = useState<string | null>(null)
  const handleSaveAssignmentsRef = useRef<() => Promise<void>>(async () => {})
  const hadDirtyAssignmentsRef = useRef(false)

  const [generatePaymentMonth, setGeneratePaymentMonth] = useState("")
  const [readyQueue, setReadyQueue] = useState<ReadyQueueCompany[]>([])
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([])
  const [isLoadingQueue, setIsLoadingQueue] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const [films, setFilms] = useState<FilmOption[]>([])
  const [companies, setCompanies] = useState<ProductionCompanyOption[]>([])
  const [newCompanyName, setNewCompanyName] = useState("")
  const [isCreatingCompany, setIsCreatingCompany] = useState(false)
  const [savingCompanyForFilmId, setSavingCompanyForFilmId] = useState<string | null>(null)
  const [assignAllCompanyId, setAssignAllCompanyId] = useState("")
  const [isAssigningAllCompanies, setIsAssigningAllCompanies] = useState(false)
  const filmsRef = useRef(films)
  filmsRef.current = films
  const programSplitsRef = useRef(programSplits)
  programSplitsRef.current = programSplits
  const [deletingUploadId, setDeletingUploadId] = useState<string | null>(null)

  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [sendIncludePortalUsers, setSendIncludePortalUsers] = useState(true)
  const [sendEmailEnabled, setSendEmailEnabled] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [recipientPreview, setRecipientPreview] = useState<{
    to: string[]
    cc: string[]
  } | null>(null)
  const [loadingRecipients, setLoadingRecipients] = useState(false)

  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null)
  const [statementDetail, setStatementDetail] = useState<{
    statement: StatementSummary & Record<string, unknown>
    lines: StatementLine[]
    productionCompanyName?: string | null
  } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadData = useCallback(async () => {
    const res = await fetch("/api/statements")
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || "Failed to load statements data")
    }
    const json = await res.json()
    setUploads(json.uploads ?? [])
    setStatements(json.statements ?? [])
  }, [])

  const loadSplits = useCallback(async () => {
    const res = await fetch("/api/statements/program-splits")
    if (!res.ok) return
    const json = await res.json()
    setProgramSplits(json.splits ?? [])
  }, [])

  const loadCompanies = useCallback(async () => {
    const res = await fetch("/api/statements/production-companies")
    if (!res.ok) return
    const json = await res.json()
    setCompanies(json.companies ?? [])
  }, [])

  const loadFilms = useCallback(async () => {
    const res = await fetch("/api/statements/films")
    if (!res.ok) return
    const json = await res.json()
    setFilms(uniqueByNormalizedTitle(json.films ?? []))
  }, [])

  const handleCreateFilm = useCallback(
    async (title: string) => {
      const res = await fetch("/api/statements/films", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not add program",
          description: json.error || "Try again.",
        })
        throw new Error(json.error || "Could not add program to library.")
      }
      const film = json.film as FilmOption
      setFilms((current) =>
        uniqueByNormalizedTitle([...current, film]).sort((a, b) => a.title.localeCompare(b.title))
      )
      toast({
        title: json.created ? "Program added to library" : "Program already in library",
        description: film.title,
      })
      return film
    },
    [toast]
  )

  const handleCreateCompany = async () => {
    const name = newCompanyName.trim()
    if (!name) {
      toast({
        variant: "destructive",
        title: "Company name required",
        description: "Enter a production company name to add it.",
      })
      return
    }
    setIsCreatingCompany(true)
    try {
      const res = await fetch("/api/statements/production-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not create company.")
      const company = json.company as ProductionCompanyOption
      setCompanies((current) => {
        if (current.some((c) => c.id === company.id)) return current
        return [...current, company].sort((a, b) => a.name.localeCompare(b.name))
      })
      setNewCompanyName("")
      setAssignAllCompanyId((current) => current || company.id)
      toast({
        title: json.created ? "Production company added" : "Company already exists",
        description: company.name,
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not add company",
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setIsCreatingCompany(false)
    }
  }

  const handleAssignCompany = async (filmId: string, productionCompanyId: string) => {
    setSavingCompanyForFilmId(filmId)
    try {
      const res = await fetch("/api/statements/films", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId, productionCompanyId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not assign company.")
      const film = json.film as FilmOption
      setFilms((current) =>
        current.map((item) => (item.film_id === film.film_id ? { ...item, ...film } : item))
      )
      if (generatePaymentMonth) await loadReadyQueue(generatePaymentMonth)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not assign production company",
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setSavingCompanyForFilmId(null)
    }
  }

  const handleAssignCompanyToAll = async (productionCompanyId: string) => {
    const filmIds = [
      ...new Set(
        rowAssignments
          .map((row) => rowEdits[row.assignment_id]?.filmId || row.film_id)
          .filter((id): id is string => Boolean(id))
      ),
    ]
    if (!productionCompanyId || filmIds.length === 0) return
    setIsAssigningAllCompanies(true)
    try {
      const filmsUpdated: FilmOption[] = []
      for (const filmId of filmIds) {
        const res = await fetch("/api/statements/films", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filmId, productionCompanyId }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Could not assign company.")
        filmsUpdated.push(json.film as FilmOption)
      }
      setFilms((current) => {
        const byId = new Map(filmsUpdated.map((film) => [film.film_id, film]))
        return current.map((item) => (byId.has(item.film_id) ? { ...item, ...byId.get(item.film_id)! } : item))
      })
      if (generatePaymentMonth) await loadReadyQueue(generatePaymentMonth)
      toast({
        title: "Production company saved",
        description: `Assigned to ${filmIds.length} film${filmIds.length === 1 ? "" : "s"}. This is remembered for future uploads.`,
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not assign production company",
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setIsAssigningAllCompanies(false)
    }
  }

  const loadRowAssignments = useCallback(
    async (uploadId: string): Promise<RowAssignment[]> => {
      setIsLoadingAssignments(true)
      try {
        const res = await fetch(`/api/statements/row-assignments?uploadId=${uploadId}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to load assignments")
        const assignments = (json.assignments ?? []).map((raw: Record<string, unknown>) =>
          mapApiRowAssignment(raw)
        )
        setRowAssignments(assignments)
        setActiveUploadMeta(json.upload ?? null)

        const edits: Record<string, RowEdit> = {}
        for (const row of assignments) {
          edits[row.assignment_id] = {
            filmId: row.film_id ?? "",
            splitProfile: row.split_profile ?? "",
            programType:
              row.program_type === "series" || row.episode_name || row.csv_episode
                ? "series"
                : "feature",
            seasonName: row.season_name ?? "",
            episodeName: row.episode_name ?? row.csv_episode ?? "",
            displayTitleOverride: row.display_title_override ?? "",
          }
        }

        setRowEdits((current) => {
          const next = { ...edits }
          for (const [id, edit] of Object.entries(current)) {
            const incoming = next[id]
            if (!incoming) continue
            if (edit.filmId && !incoming.filmId) {
              next[id] = { ...incoming, filmId: edit.filmId, splitProfile: edit.splitProfile }
            }
          }
          return applyAutoMatchToEdits(
            assignments,
            next,
            filmsRef.current,
            programSplitsRef.current
          )
        })
        setAssignmentPage(0)
        return assignments
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Could not load row assignments",
          description: e instanceof Error ? e.message : "Unknown error",
        })
        return []
      } finally {
        setIsLoadingAssignments(false)
      }
    },
    [toast]
  )

  const loadReadyQueue = useCallback(
    async (month: string) => {
      if (!month) {
        setReadyQueue([])
        return
      }
      setIsLoadingQueue(true)
      try {
        const res = await fetch(`/api/statements/ready-queue?paymentMonth=${month}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to load queue")
        const companies = json.companies ?? []
        setReadyQueue(companies)
        setSelectedAssignmentIds(
          companies.flatMap((company: ReadyQueueCompany) =>
            company.items
              .filter((item) => item.status === "ready")
              .map((item) => item.assignment_id)
          )
        )
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Could not load generate queue",
          description: e instanceof Error ? e.message : "Unknown error",
        })
      } finally {
        setIsLoadingQueue(false)
      }
    },
    [toast]
  )

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      const { data: userRecord } = await supabase
        .from("users")
        .select("role")
        .eq("auth_user_id", user.id)
        .single()

      if (userRecord?.role !== "admin") {
        router.push("/dashboard")
        return
      }
      setIsAdmin(true)
      try {
        await loadFilms()
        await Promise.all([loadData(), loadSplits(), loadCompanies()])
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Error",
          description: e instanceof Error ? e.message : "Failed to load data",
        })
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router, loadData, loadSplits, loadFilms, loadCompanies, toast])

  useEffect(() => {
    if (generatePaymentMonth) {
      loadReadyQueue(generatePaymentMonth)
    } else {
      setReadyQueue([])
    }
  }, [generatePaymentMonth, loadReadyQueue])

  useEffect(() => {
    if (activeUploadId) loadRowAssignments(activeUploadId)
  }, [activeUploadId, loadRowAssignments])

  const libraryTitleKeys = useMemo(() => {
    const keys = new Set(films.map((f) => normalizeProgramName(f.title)))
    for (const film of films) {
      const catalog = findBseFilm(film.title)
      if (!catalog) continue
      keys.add(normalizeProgramName(catalog.title))
      for (const alias of catalog.aliases) {
        keys.add(normalizeProgramName(alias))
      }
    }
    for (const split of programSplits) {
      keys.add(split.program_name_normalized ?? normalizeProgramName(split.program_name))
    }
    return keys
  }, [films, programSplits])

  const filmTitleById = useMemo(
    () => new Map(films.map((film) => [film.film_id, film.title])),
    [films]
  )

  const filmsInUpload = useMemo(() => {
    const ids = new Set<string>()
    for (const row of rowAssignments) {
      const filmId = rowEdits[row.assignment_id]?.filmId || row.film_id
      if (filmId) ids.add(filmId)
    }
    return films
      .filter((film) => ids.has(film.film_id))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [rowAssignments, rowEdits, films])

  const unassignedCompanyCount = filmsInUpload.filter((film) => !film.production_company_id).length

  const programSplitByFilmId = useMemo(
    () => new Map(programSplits.filter((s) => s.film_id).map((s) => [s.film_id!, s])),
    [programSplits]
  )

  const groupedProgramDefaults = useMemo(
    () => groupProgramDefaults(programSplits, filmTitleById),
    [programSplits, filmTitleById]
  )

  const filteredProgramDefaults = useMemo(() => {
    const q = defaultsSearch.trim().toLowerCase()
    const normalizedQuery = normalizeProgramName(defaultsSearch)
    if (!q) return groupedProgramDefaults
    return groupedProgramDefaults.filter((item) => {
      const haystack = [item.title, ...item.aliases].join(" ")
      return (
        haystack.toLowerCase().includes(q) ||
        (normalizedQuery !== "" && normalizeProgramName(haystack).includes(normalizedQuery))
      )
    })
  }, [groupedProgramDefaults, defaultsSearch])

  const defaultsHaveSeries = groupedProgramDefaults.some((item) => item.program_type === "series")

  const platformOptions = useMemo(() => {
    const known = new Set(PLATFORM_OPTIONS.map((name) => name.toLowerCase()))
    const custom = uploads
      .map((upload) => upload.platform.trim())
      .filter(
        (name) =>
          name &&
          name.toLowerCase() !== "other" &&
          !known.has(name.toLowerCase())
      )
    return [...PLATFORM_OPTIONS, ...new Set(custom)]
  }, [uploads])

  const filteredRowAssignments = useMemo(() => {
    const q = assignmentSearch.trim().toLowerCase()
    if (!q) return rowAssignments
    return rowAssignments.filter((row) =>
      rowMatchesAssignmentSearch(row, q, rowEdits[row.assignment_id], filmTitleById)
    )
  }, [rowAssignments, assignmentSearch, rowEdits, filmTitleById])

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredRowAssignments.length / ROWS_PER_PAGE) - 1)
    if (assignmentPage > maxPage) {
      setAssignmentPage(maxPage)
    }
  }, [filteredRowAssignments.length, assignmentPage])

  const paginatedRowAssignments = useMemo(() => {
    const start = assignmentPage * ROWS_PER_PAGE
    return filteredRowAssignments.slice(start, start + ROWS_PER_PAGE)
  }, [filteredRowAssignments, assignmentPage])

  const assignmentPageCount = Math.max(1, Math.ceil(filteredRowAssignments.length / ROWS_PER_PAGE))

  const readyAssignmentCount = useMemo(
    () =>
      rowAssignments.filter((row) => {
        const edit = rowEdits[row.assignment_id]
        if (!edit) return row.status === "ready"
        return displayRowStatus(row, edit) === "ready"
      }).length,
    [rowAssignments, rowEdits]
  )

  const dirtyAssignmentIds = useMemo(() => {
    return rowAssignments
      .filter((row) => {
        const edit = rowEdits[row.assignment_id]
        if (!edit) return false
        return (
          (edit.filmId || null) !== (row.film_id || null) ||
          (edit.splitProfile || null) !== (row.split_profile || null) ||
          edit.programType !== (row.program_type || "feature") ||
          (edit.seasonName || null) !== (row.season_name || null) ||
          (edit.episodeName || null) !== (row.episode_name || null) ||
          (edit.displayTitleOverride || null) !== (row.display_title_override || null)
        )
      })
      .map((r) => r.assignment_id)
  }, [rowAssignments, rowEdits])

  const getRowEdit = (row: RowAssignment): RowEdit =>
    rowEdits[row.assignment_id] ?? {
      filmId: row.film_id ?? "",
      splitProfile: row.split_profile ?? "",
      programType:
        row.program_type === "series" || row.episode_name || row.csv_episode
          ? "series"
          : "feature",
      seasonName: row.season_name ?? "",
      episodeName: row.episode_name ?? row.csv_episode ?? "",
      displayTitleOverride: row.display_title_override ?? "",
    }

  const updateRowEdit = (assignmentId: string, patch: Partial<RowEdit>) => {
    setRowEdits((current) => {
      const row = rowAssignments.find((r) => r.assignment_id === assignmentId)
      const base = row ? getRowEdit(row) : current[assignmentId]
      if (!base) return current
      const next = { ...base, ...patch }
      if (patch.filmId && patch.filmId !== base.filmId) {
        const saved = programSplitByFilmId.get(patch.filmId)
        const csvEpisode = row?.csv_episode?.trim()
        const catalogSplit = splitProfileForFilmName(
          filmTitleById.get(patch.filmId) ?? row?.program_name ?? ""
        )
        if (saved) {
          next.splitProfile = saved.split_profile
          next.programType = csvEpisode ? "series" : saved.program_type || "feature"
          next.seasonName = saved.season_name || base.seasonName
          next.episodeName = csvEpisode || saved.episode_name || base.episodeName
          next.displayTitleOverride = saved.display_title_override ?? ""
        } else if (catalogSplit && !next.splitProfile) {
          next.splitProfile = catalogSplit
        }
      }
      if (patch.programType === "feature") {
        next.seasonName = ""
        next.episodeName = ""
      }
      return { ...current, [assignmentId]: next }
    })
  }

  const handleCsvFileChange = async (fileList: FileList | null) => {
    const file = fileList?.[0] ?? null
    setCsvFile(file)
    setCsvPreviewPrograms([])
    setCsvPreviewError(null)
    if (!file) return

    try {
      const text = await file.text()
      const { rows, errors } = parseStatementCsv(text)
      if (errors.length > 0) {
        setCsvPreviewError(`${file.name}: ${errors.join(" ")}`)
        return
      }

      const programNames = new Set<string>()
      rows.forEach((row) => {
        const name = row.programName.trim()
        if (name) programNames.add(name)
      })

      setCsvPreviewPrograms(
        Array.from(programNames).map((name) => ({
          name,
          inLibrary: libraryTitleKeys.has(normalizeProgramName(name)),
        }))
      )
    } catch {
      setCsvPreviewError("Could not read the CSV file.")
    }
  }

  const handleUpload = async () => {
    const resolvedPlatform =
      platform === CUSTOM_PLATFORM_OPTION ? customPlatform.trim() : platform.trim()
    const hasValidPeriod =
      Boolean(uploadPeriodStart) &&
      Boolean(uploadPeriodEnd) &&
      uploadPeriodStart <= uploadPeriodEnd
    if (!csvFile || !resolvedPlatform || !hasValidPeriod) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description:
          platform === CUSTOM_PLATFORM_OPTION && !customPlatform.trim()
            ? "Enter the custom platform name."
            : "Select a platform, valid period start and end dates, and a CSV file.",
      })
      return
    }

    setIsUploading(true)
    try {
      const form = new FormData()
      form.append("file", csvFile)
      form.append("platform", resolvedPlatform)
      form.append("periodStart", uploadPeriodStart)
      form.append("periodEnd", uploadPeriodEnd)

      const res = await fetch("/api/statements/upload", { method: "POST", body: form })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.details?.join?.("\n") || json.error || "Upload failed")
      }

      toast({
        title: "Statement CSV uploaded",
        description: `${json.rowCount} rows · ${formatMoney(json.totalGross)} gross`,
      })

      const uploadId = json.upload?.upload_id as string
      setActiveUploadId(uploadId)
      setCsvFile(null)
      setCsvInputKey((key) => key + 1)
      setCsvPreviewPrograms([])
      setCsvPreviewError(null)
      await loadData()
      await loadRowAssignments(uploadId)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const notifySaveAssignments = useCallback(
    (description: string, variant?: "default" | "destructive") => {
      toast({
        variant,
        title: "Save your assignments",
        description,
        action: (
          <ToastAction
            altText="Save assignments"
            onClick={() => void handleSaveAssignmentsRef.current()}
          >
            Save
          </ToastAction>
        ),
      })
    },
    [toast]
  )

  const handleSaveAssignments = async () => {
    const idsToSave = dirtyAssignmentIds.length > 0 ? dirtyAssignmentIds : rowAssignments.map((r) => r.assignment_id)
    const missingSplitRows: string[] = []
    const missingEpisodeRows: string[] = []
    const patches = idsToSave
      .map((assignmentId) => {
        const edit = rowEdits[assignmentId]
        const row = rowAssignments.find((r) => r.assignment_id === assignmentId)
        if (!edit?.filmId) return null
        if (!edit.splitProfile) {
          missingSplitRows.push(row?.program_name ?? assignmentId)
          return null
        }
        if (edit.programType === "series" && !edit.episodeName.trim()) {
          missingEpisodeRows.push(row?.program_name ?? assignmentId)
          return null
        }
        return {
          assignmentId,
          filmId: edit.filmId,
          splitProfile: edit.splitProfile,
          programType: edit.programType,
          seasonName: edit.seasonName.trim() || null,
          episodeName: edit.episodeName.trim() || null,
          displayTitleOverride: edit.displayTitleOverride.trim() || null,
        }
      })
      .filter(Boolean)

    if (missingSplitRows.length > 0) {
      toast({
        variant: "destructive",
        title: "Split profile required",
        description: `Choose a split for: ${missingSplitRows.slice(0, 3).join(", ")}${missingSplitRows.length > 3 ? "…" : ""}`,
      })
      return
    }

    if (missingEpisodeRows.length > 0) {
      toast({
        variant: "destructive",
        title: "Episode required",
        description: `Enter an episode for: ${missingEpisodeRows.slice(0, 3).join(", ")}${missingEpisodeRows.length > 3 ? "…" : ""}`,
      })
      return
    }

    if (patches.length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to save",
        description: "Assign a library program and split profile to at least one row.",
      })
      return
    }

    setIsSavingAssignments(true)
    try {
      const res = await fetch("/api/statements/row-assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: patches }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.errors?.join(" ") || "Save failed")
      const readySaved = Array.isArray(json.assignments)
        ? json.assignments.filter((a: { status?: string }) => a.status === "ready").length
        : 0
      if (activeUploadId) await loadRowAssignments(activeUploadId)
      if (generatePaymentMonth) await loadReadyQueue(generatePaymentMonth)

      toast({
        title: "Assignments saved",
        description:
          readySaved > 0
            ? `${json.updated} row(s) saved · ${readySaved} ready after a production company is assigned`
            : `${json.updated} row(s) saved`,
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save assignments",
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setIsSavingAssignments(false)
    }
  }
  handleSaveAssignmentsRef.current = handleSaveAssignments

  const handleSaveProgramDefault = async (assignmentId: string) => {
    const row = rowAssignments.find((r) => r.assignment_id === assignmentId)
    if (!row) return
    const edit = getRowEdit(row)

    if (!canSaveProgramDefault(edit)) {
      toast({
        variant: "destructive",
        title: "Cannot save default",
        description: "Assign a library program, split, and episode (if series) first.",
      })
      return
    }

    setSavingDefaultForId(assignmentId)
    try {
      const res = await fetch("/api/statements/program-splits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filmId: edit.filmId,
          splitProfile: edit.splitProfile,
          programType: edit.programType,
          seasonName: edit.seasonName.trim() || null,
          episodeName: edit.episodeName.trim() || null,
          displayTitleOverride: edit.displayTitleOverride.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to save default")

      const filmTitle = filmTitleById.get(edit.filmId) ?? row.program_name
      toast({
        title: "Program default saved",
        description: `${filmTitle} and its split are saved for future uploads.`,
      })
      await loadSplits()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save default",
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setSavingDefaultForId(null)
    }
  }

  const handleSelectActiveUpload = (uploadId: string) => {
    if (uploadId === activeUploadId) return
    if (dirtyAssignmentIds.length > 0) {
      notifySaveAssignments(
        `${dirtyAssignmentIds.length} unsaved change${dirtyAssignmentIds.length === 1 ? "" : "s"}. Save before switching uploads.`,
        "destructive"
      )
      return
    }
    setActiveUploadId(uploadId)
  }

  useEffect(() => {
    const hasDirty = dirtyAssignmentIds.length > 0
    if (hasDirty && !hadDirtyAssignmentsRef.current && activeUploadId) {
      notifySaveAssignments(
        "You have unsaved split assignments. Save before continuing to generate statements."
      )
    }
    hadDirtyAssignmentsRef.current = hasDirty
  }, [dirtyAssignmentIds.length, activeUploadId, notifySaveAssignments])

  const handleGenerate = async () => {
    if (dirtyAssignmentIds.length > 0) {
      notifySaveAssignments(
        `${dirtyAssignmentIds.length} unsaved change${dirtyAssignmentIds.length === 1 ? "" : "s"}. Save assignments before generating statements.`,
        "destructive"
      )
      return
    }

    if (!generatePaymentMonth || selectedAssignmentIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Select a payment month and at least one ready row.",
      })
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch("/api/statements/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentIds: selectedAssignmentIds,
          paymentMonth: generatePaymentMonth,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Generate failed")

      if (json.warnings?.length) {
        toast({
          title: "Statement created with notes",
          description: json.warnings.join(" "),
        })
      } else {
        toast({ title: "Statement generated", description: `${json.lineCount} line(s)` })
      }

      await loadData()
      await loadReadyQueue(generatePaymentMonth)
      if (activeUploadId) await loadRowAssignments(activeUploadId)
      setSelectedStatementId(json.statementId)
      await loadStatementDetail(json.statementId)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleCompanySelection = (company: ReadyQueueCompany, checked: boolean) => {
    const eligible = company.items.filter((item) => item.status === "ready").map((i) => i.assignment_id)
    setSelectedAssignmentIds((current) => {
      if (checked) return Array.from(new Set([...current, ...eligible]))
      const remove = new Set(eligible)
      return current.filter((id) => !remove.has(id))
    })
  }

  const toggleAssignmentSelection = (assignmentId: string, checked: boolean) => {
    setSelectedAssignmentIds((current) =>
      checked ? Array.from(new Set([...current, assignmentId])) : current.filter((id) => id !== assignmentId)
    )
  }

  const loadStatementDetail = async (id: string) => {
    setLoadingDetail(true)
    setSelectedStatementId(id)
    try {
      const res = await fetch(`/api/statements/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setStatementDetail(json)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not load statement",
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleDeleteUpload = async (upload: StatementUpload) => {
    const confirmed = window.confirm(
      `Delete CSV upload "${upload.file_name}"?\n\nThis removes the uploaded CSV from the statement generator. Existing generated statements keep their saved line snapshots.`
    )
    if (!confirmed) return

    setDeletingUploadId(upload.upload_id)
    try {
      const res = await fetch(`/api/statements?uploadId=${upload.upload_id}`, {
        method: "DELETE",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Delete failed")
      toast({ title: "CSV upload deleted" })
      if (activeUploadId === upload.upload_id) {
        setActiveUploadId(null)
        setActiveUploadMeta(null)
        setRowAssignments([])
        setRowEdits({})
      }
      await loadData()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not delete CSV upload",
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setDeletingUploadId(null)
    }
  }

  const handlePrint = () => {
    printStatement()
  }

  useEffect(() => {
    if (!sendDialogOpen || !selectedStatementId) {
      setRecipientPreview(null)
      return
    }

    let cancelled = false
    const loadRecipients = async () => {
      setLoadingRecipients(true)
      try {
        const res = await fetch(
          `/api/statements/${selectedStatementId}/recipients?includePortalUsers=${sendIncludePortalUsers ? "true" : "false"}`
        )
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Failed to load recipients.")
        if (!cancelled) {
          setRecipientPreview({
            to: json.recipients?.to || [],
            cc: json.recipients?.cc || [],
          })
        }
      } catch {
        if (!cancelled) {
          setRecipientPreview({ to: [], cc: [] })
        }
      } finally {
        if (!cancelled) setLoadingRecipients(false)
      }
    }

    void loadRecipients()
    return () => {
      cancelled = true
    }
  }, [sendDialogOpen, selectedStatementId, sendIncludePortalUsers])

  const handleSendStatement = async () => {
    if (!selectedStatementId) return
    setIsSending(true)
    try {
      const res = await fetch(`/api/statements/${selectedStatementId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendEmail: sendEmailEnabled,
          includePortalUsers: sendIncludePortalUsers,
          makeVisible: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Send failed")
      toast({
        title: sendEmailEnabled ? "Statement published and sent" : "Statement published",
        description: sendEmailEnabled
          ? `Visible in My Statements. PDF emailed to ${json.recipients?.to?.join(", ") || "recipients"}.`
          : "Visible to the production company in My Statements.",
      })
      setSendDialogOpen(false)
      await loadData()
      await loadStatementDetail(selectedStatementId)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not send statement",
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setIsSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading statements…
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 print:m-0 print:max-w-none print:space-y-0 print:px-0 print:py-0">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div className="space-y-2">
          <Badge variant="outline" className="font-normal tracking-wider text-primary">
            Admin
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Statement Generator</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Upload finalized platform CSV reports, assign splits and a production company, then
            generate draft statements for review and PDF export.
          </p>
        </div>
      </div>

      <Alert className="border-primary/20 bg-accent-light print:hidden">
        <AlertDescription>
          Statement CSV format: Program Name, Episode, Gross Earned, Impressions, ECPM. Upload one
          platform CSV per payment month (many programs per file), assign splits, assign a production
          company to each film, then select the statement period when generating.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="generator" className="print:hidden">
        <TabsList>
          <TabsTrigger value="generator">Generator</TabsTrigger>
          <TabsTrigger value="history">Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="generator" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generator workflow</CardTitle>
              <CardDescription>
                Upload a platform CSV, assign splits, assign a production company to each film, then
                generate draft statements grouped by company.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <section className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                    1
                  </span>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">Upload platform CSV</h2>
                    <p className="text-sm text-muted-foreground">
                      Select the platform and its revenue period, then upload a CSV with all programs
                      for that platform.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {platformOptions.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_PLATFORM_OPTION}>Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {platform === CUSTOM_PLATFORM_OPTION ? (
                      <Input
                        value={customPlatform}
                        onChange={(e) => setCustomPlatform(e.target.value)}
                        placeholder="Enter platform name"
                        maxLength={100}
                      />
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Period start</Label>
                    <Input
                      type="date"
                      value={uploadPeriodStart}
                      onChange={(e) => setUploadPeriodStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Period end</Label>
                    <Input
                      type="date"
                      value={uploadPeriodEnd}
                      onChange={(e) => setUploadPeriodEnd(e.target.value)}
                      min={uploadPeriodStart || undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CSV file</Label>
                    <Input
                      key={csvInputKey}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => handleCsvFileChange(e.target.files)}
                    />
                  </div>
                </div>
                <p className="text-xs text-ink/40">
                  CSV format: Program Name, Episode, Gross Earned, Impressions, ECPM.
                  {csvFile ? ` Selected: ${csvFile.name}.` : ""}
                </p>
                {csvPreviewError && <p className="text-xs text-rust">{csvPreviewError}</p>}
                {csvPreviewPrograms.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
                    <p className="text-xs font-medium text-ink/50">
                      {csvPreviewPrograms.length} program{csvPreviewPrograms.length === 1 ? "" : "s"} in file
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {csvPreviewPrograms.slice(0, 12).map((p) => (
                        <Badge
                          key={p.name}
                          variant="secondary"
                          className={
                            p.inLibrary
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }
                        >
                          {p.name}
                        </Badge>
                      ))}
                      {csvPreviewPrograms.length > 12 && (
                        <Badge variant="secondary">+{csvPreviewPrograms.length - 12} more</Badge>
                      )}
                    </ul>
                  </div>
                )}
                <Button
                  onClick={handleUpload}
                  disabled={
                    isUploading ||
                    !platform ||
                    (platform === CUSTOM_PLATFORM_OPTION && !customPlatform.trim()) ||
                    !uploadPeriodStart ||
                    !uploadPeriodEnd ||
                    uploadPeriodStart > uploadPeriodEnd ||
                    !csvFile
                  }
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Upload CSV
                </Button>
                {activeUploadMeta && (
                  <div className="rounded-md border border-primary/20 bg-accent-light p-3 text-sm text-muted-foreground">
                    Active upload: <span className="font-medium text-foreground">{activeUploadMeta.file_name}</span> ·{" "}
                    {activeUploadMeta.platform} · {formatDate(activeUploadMeta.period_start)} –{" "}
                    {formatDate(activeUploadMeta.period_end)}
                  </div>
                )}
              </section>

              <Separator />

              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      2
                    </span>
                    <div>
                      <h2 className="text-base font-semibold tracking-tight">Assign splits</h2>
                      <p className="text-sm text-muted-foreground">
                        Assign library program, Feature/Series, and split profile for each uploaded
                        row. Use Save default to remember a program and split for future uploads.
                      </p>
                    </div>
                  </div>
                  {rowAssignments.length > 0 && (
                    <Badge variant="secondary">
                      {readyAssignmentCount} of {rowAssignments.length} ready
                    </Badge>
                  )}
                </div>
                {!activeUploadId ? (
                  <p className="text-sm text-ink/40">Upload a CSV in Step 1 to assign splits.</p>
                ) : isLoadingAssignments ? (
                  <div className="flex items-center py-4 text-sm text-ink/50">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading rows…
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex min-w-[240px] max-w-sm flex-1 flex-col gap-1">
                        <Input
                          value={assignmentSearch}
                          onChange={(e) => {
                            setAssignmentSearch(e.target.value)
                            setAssignmentPage(0)
                          }}
                          placeholder="Search programs…"
                          aria-label="Search programs in upload"
                        />
                        {assignmentSearch.trim() ? (
                          <p className="text-xs text-ink/40">
                            Showing {filteredRowAssignments.length} of {rowAssignments.length} row
                            {rowAssignments.length === 1 ? "" : "s"}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setRowEdits((current) =>
                            applyAutoMatchToEdits(rowAssignments, current, films, programSplits)
                          )
                          toast({
                            title: "Auto-match applied",
                            description: "Library programs and saved splits filled in where names matched.",
                          })
                        }}
                      >
                        Auto-match library
                      </Button>
                      <Button onClick={handleSaveAssignments} disabled={isSavingAssignments}>
                        {isSavingAssignments ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save assignments
                        {dirtyAssignmentIds.length > 0 ? ` (${dirtyAssignmentIds.length})` : ""}
                      </Button>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-ink/10">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>CSV program</TableHead>
                            <TableHead className="text-right">Gross</TableHead>
                            <TableHead className="min-w-[200px]">Library program</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Season</TableHead>
                            <TableHead>Episode</TableHead>
                            <TableHead className="min-w-[180px]">Split</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="min-w-[108px]">Default</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedRowAssignments.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="py-8 text-center text-ink/40">
                                {assignmentSearch.trim()
                                  ? `No programs match "${assignmentSearch.trim()}".`
                                  : "No rows in this upload."}
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedRowAssignments.map((row) => {
                              const edit = getRowEdit(row)
                              const savedDefault = edit.filmId
                                ? programSplitByFilmId.get(edit.filmId)
                                : undefined
                              const defaultMatches = editMatchesSavedDefault(edit, savedDefault)
                              const canSaveDefault = canSaveProgramDefault(edit)
                              const isSavingDefault = savingDefaultForId === row.assignment_id
                              const isAutoMatched =
                                !row.film_id &&
                                Boolean(edit.filmId) &&
                                resolveFilmIdForCsvProgram(
                                  row.program_name,
                                  films,
                                  toProgramSplitMatches(programSplits)
                                ) === edit.filmId
                              return (
                                <TableRow key={row.assignment_id} className="align-top">
                                  <TableCell className="text-ink">
                                    <div>{row.program_name}</div>
                                    <div className="text-xs text-ink/40">{row.platform}</div>
                                    {isAutoMatched ? (
                                      <Badge variant="secondary" className="mt-1">
                                        Auto-matched
                                      </Badge>
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="text-right text-ink/70">
                                    {formatMoney(Number(row.gross_earned || 0))}
                                  </TableCell>
                                  <TableCell>
                                    <ProgramFilmPicker
                                      films={films}
                                      value={edit.filmId}
                                      suggestedName={row.program_name}
                                      onValueChange={(id) => updateRowEdit(row.assignment_id, { filmId: id })}
                                      onCreateFilm={handleCreateFilm}
                                      placeholder="Search or add…"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={edit.programType}
                                      onValueChange={(v) =>
                                        updateRowEdit(row.assignment_id, { programType: v as ProgramType })
                                      }
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="feature">Feature</SelectItem>
                                        <SelectItem value="series">Series</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    {edit.programType === "series" ? (
                                      <Input
                                        value={edit.seasonName}
                                        onChange={(e) =>
                                          updateRowEdit(row.assignment_id, { seasonName: e.target.value })
                                        }
                                        placeholder="Season"
                                        className="h-9"
                                      />
                                    ) : (
                                      <span className="text-sm text-ink/30">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {edit.programType === "series" ? (
                                      <Input
                                        value={edit.episodeName}
                                        onChange={(e) =>
                                          updateRowEdit(row.assignment_id, { episodeName: e.target.value })
                                        }
                                        placeholder="Episode"
                                        className="h-9"
                                      />
                                    ) : (
                                      <span className="text-sm text-ink/30">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={edit.splitProfile || undefined}
                                      onValueChange={(v) =>
                                        updateRowEdit(row.assignment_id, { splitProfile: v as SplitProfile })
                                      }
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select split…" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {SPLIT_PROFILE_OPTIONS.map((p) => (
                                          <SelectItem key={p} value={p}>
                                            {splitProfileLabel(p)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    {(() => {
                                      const status = displayRowStatus(row, edit)
                                      return (
                                        <Badge
                                          variant="secondary"
                                          className={
                                            status === "ready"
                                              ? "bg-emerald-100 text-emerald-700"
                                              : status === "statemented"
                                                ? "bg-ink/5 text-ink/50"
                                                : "bg-amber-100 text-amber-700"
                                          }
                                        >
                                          {status === "ready"
                                            ? "Ready"
                                            : status === "statemented"
                                              ? "Statemented"
                                              : "Pending"}
                                        </Badge>
                                      )
                                    })()}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={
                                        !canSaveDefault ||
                                        isSavingDefault ||
                                        defaultMatches ||
                                        row.status === "statemented"
                                      }
                                      onClick={() => handleSaveProgramDefault(row.assignment_id)}
                                      className="whitespace-nowrap"
                                    >
                                      {isSavingDefault ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : defaultMatches ? (
                                        "Saved"
                                      ) : savedDefault ? (
                                        "Update default"
                                      ) : (
                                        "Save default"
                                      )}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {assignmentPageCount > 1 && (
                      <div className="flex items-center justify-between text-sm text-ink/50">
                        <span>
                          Page {assignmentPage + 1} of {assignmentPageCount} ·{" "}
                          {filteredRowAssignments.length} row
                          {filteredRowAssignments.length === 1 ? "" : "s"}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={assignmentPage === 0}
                            onClick={() => setAssignmentPage((p) => Math.max(0, p - 1))}
                          >
                            Previous
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={assignmentPage >= assignmentPageCount - 1}
                            onClick={() =>
                              setAssignmentPage((p) => Math.min(assignmentPageCount - 1, p + 1))
                            }
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>

              <Separator />

              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      3
                    </span>
                    <div>
                      <h2 className="text-base font-semibold tracking-tight">Assign production company</h2>
                      <p className="text-sm text-muted-foreground">
                        Create a company if you do not have one on file, then assign it to each film.
                        The assignment is saved on the film and reused on future uploads.
                      </p>
                    </div>
                  </div>
                  {filmsInUpload.length > 0 && (
                    <Badge variant="secondary">
                      {filmsInUpload.length - unassignedCompanyCount} of {filmsInUpload.length} assigned
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="space-y-2 sm:max-w-sm sm:flex-1">
                    <Label htmlFor="new-company-name">Add production company</Label>
                    <Input
                      id="new-company-name"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="e.g. BSE"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void handleCreateCompany()
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleCreateCompany()}
                    disabled={isCreatingCompany || !newCompanyName.trim()}
                  >
                    {isCreatingCompany ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add company
                  </Button>
                </div>

                {companies.length === 0 ? (
                  <p className="text-sm text-ink/40">
                    No production companies on file yet. Add one above, then assign it to each film.
                  </p>
                ) : filmsInUpload.length > 1 ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="space-y-2 sm:max-w-sm sm:flex-1">
                      <Label>Assign one company to all films in this upload</Label>
                      <Select
                        value={assignAllCompanyId || undefined}
                        onValueChange={setAssignAllCompanyId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleAssignCompanyToAll(assignAllCompanyId)}
                      disabled={!assignAllCompanyId || isAssigningAllCompanies}
                    >
                      {isAssigningAllCompanies ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Assign to all films
                    </Button>
                  </div>
                ) : null}

                {!activeUploadId ? (
                  <p className="text-sm text-ink/40">
                    Upload a CSV and assign programs in Step 2 to see films here.
                  </p>
                ) : filmsInUpload.length === 0 ? (
                  <p className="text-sm text-ink/40">
                    Assign library programs in Step 2 first. Each unique film will appear here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filmsInUpload.map((film) => (
                      <div
                        key={film.film_id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{film.title}</p>
                          <p className="text-xs text-ink/40">
                            {film.production_company_id
                              ? "Saved on this film for future statements"
                              : "No production company assigned yet"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {savingCompanyForFilmId === film.film_id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-ink/40" />
                          ) : null}
                          <Select
                            value={film.production_company_id ?? undefined}
                            onValueChange={(companyId) => void handleAssignCompany(film.film_id, companyId)}
                            disabled={companies.length === 0 || savingCompanyForFilmId === film.film_id}
                          >
                            <SelectTrigger className="w-[220px]">
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                            <SelectContent>
                              {companies.map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <Separator />

              <section className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                    4
                  </span>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">Generate draft statement</h2>
                    <p className="text-sm text-muted-foreground">
                      Select ready rows grouped by production company. Multiple programs can be
                      included on one statement.
                    </p>
                  </div>
                </div>
                <div className="max-w-xs">
                  <div className="space-y-2">
                    <Label>Payment month</Label>
                    <Input
                      type="month"
                      value={generatePaymentMonth}
                      onChange={(e) => setGeneratePaymentMonth(e.target.value)}
                    />
                  </div>
                </div>
                {isLoadingQueue ? (
                  <div className="flex items-center py-4 text-sm text-ink/50">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading queue…
                  </div>
                ) : !generatePaymentMonth ? (
                  <p className="text-sm text-ink/40">Select a payment month to view the queue.</p>
                ) : readyQueue.length === 0 ? (
                  <p className="text-sm text-ink/40">
                    No rows are ready yet. Assign splits in Step 2 and a production company in Step 3.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {readyQueue.map((company) => {
                      const eligible = company.items.filter((item) => item.status === "ready")
                      const allEligibleSelected =
                        eligible.length > 0 &&
                        eligible.every((item) => selectedAssignmentIds.includes(item.assignment_id))
                      return (
                        <div
                          key={company.production_company_id}
                          className="space-y-3 rounded-lg border border-ink/10 bg-ink/[0.015] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-ink">{company.company_name}</p>
                            {eligible.length > 0 && (
                              <label className="flex items-center gap-2 text-sm text-ink/70">
                                <Checkbox
                                  checked={allEligibleSelected}
                                  onCheckedChange={(v) => toggleCompanySelection(company, v === true)}
                                />
                                Select all ready ({eligible.length})
                              </label>
                            )}
                          </div>
                          <div className="space-y-2">
                            {company.items.map((item) => {
                              const isStatemented = item.status === "statemented"
                              const isReady = item.status === "ready"
                              const checked = selectedAssignmentIds.includes(item.assignment_id)
                              return (
                                <label
                                  key={item.assignment_id}
                                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
                                    isStatemented
                                      ? "border-ink/10 bg-ink/[0.02] opacity-50"
                                      : "border-ink/10 bg-white"
                                  }`}
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <Checkbox
                                      checked={checked}
                                      disabled={!isReady}
                                      onCheckedChange={(v) =>
                                        toggleAssignmentSelection(item.assignment_id, v === true)
                                      }
                                    />
                                    <div className="min-w-0">
                                      <p className="truncate text-ink">{item.film_title || item.program_name}</p>
                                      <p className="text-xs text-ink/40">
                                        {item.platform}
                                        {item.period_start && item.period_end
                                          ? ` (${formatDate(item.period_start)} – ${formatDate(item.period_end)})`
                                          : ""}{" "}
                                        · {item.split_label} · {formatMoney(item.gross)}
                                      </p>
                                    </div>
                                  </div>
                                  {isReady ? (
                                    <Badge className="shrink-0 bg-amber-100 text-amber-700">Needs statement</Badge>
                                  ) : isStatemented ? (
                                    <Badge variant="secondary" className="shrink-0">
                                      Statemented
                                    </Badge>
                                  ) : null}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || selectedAssignmentIds.length === 0 || !generatePaymentMonth}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Generate draft statement ({selectedAssignmentIds.length} row
                  {selectedAssignmentIds.length === 1 ? "" : "s"})
                </Button>
              </section>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent uploads</CardTitle>
              </CardHeader>
              <CardContent>
                {uploads.length === 0 ? (
                  <p className="text-sm text-ink/40">No statement uploads yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Programs</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Platform period</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploads.map((u) => (
                        <TableRow key={u.upload_id}>
                          <TableCell className="text-ink">
                            <button
                              type="button"
                              className="text-left hover:text-accent"
                              onClick={() => handleSelectActiveUpload(u.upload_id)}
                            >
                              {u.file_name}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-ink/70">
                            {(u.program_names?.length ?? 0) > 0
                              ? `${u.program_names!.length} programs`
                              : "—"}
                          </TableCell>
                          <TableCell>{u.platform}</TableCell>
                          <TableCell className="text-sm text-ink/70">
                            {formatDate(u.period_start)} – {formatDate(u.period_end)}
                          </TableCell>
                          <TableCell className="text-right text-ink">
                            {formatMoney(Number(u.total_gross))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteUpload(u)}
                              disabled={deletingUploadId === u.upload_id}
                              className="text-rust hover:bg-rust/10"
                              title="Delete CSV upload"
                            >
                              {deletingUploadId === u.upload_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              <span className="sr-only">Delete CSV upload</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="text-lg">Saved program defaults</CardTitle>
                  <CardDescription>
                    {groupedProgramDefaults.length} title
                    {groupedProgramDefaults.length === 1 ? "" : "s"} auto-match on future uploads.
                    Aliases like DIL and TTD are grouped under the library title.
                  </CardDescription>
                </div>
                {programSplits.length > 0 ? (
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
                    <Input
                      value={defaultsSearch}
                      onChange={(e) => setDefaultsSearch(e.target.value)}
                      placeholder="Search titles…"
                      aria-label="Search saved program defaults"
                      className="h-9 pl-8"
                    />
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                {programSplits.length === 0 ? (
                  <p className="text-sm text-ink/40">No saved program defaults yet.</p>
                ) : filteredProgramDefaults.length === 0 ? (
                  <p className="text-sm text-ink/40">
                    No titles match “{defaultsSearch.trim()}”.
                  </p>
                ) : (
                  <div className="max-h-[28rem] overflow-auto rounded-md border border-ink/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Program</TableHead>
                          <TableHead className="w-24">Split</TableHead>
                          {defaultsHaveSeries ? <TableHead className="w-28">Episode</TableHead> : null}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProgramDefaults.map((item) => (
                          <TableRow key={item.key}>
                            <TableCell className="py-2">
                              <div className="font-medium text-ink">{item.title}</div>
                              {item.aliases.length > 0 ? (
                                <div className="mt-0.5 text-xs text-ink/45">
                                  Also {item.aliases.join(", ")}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="py-2 tabular-nums text-ink">
                              {splitProfileShortLabel(item.split_profile)}
                            </TableCell>
                            {defaultsHaveSeries ? (
                              <TableCell className="py-2 text-ink/60">
                                {item.program_type === "series"
                                  ? [item.season_name, item.episode_name].filter(Boolean).join(" · ") ||
                                    "Series"
                                  : "—"}
                              </TableCell>
                            ) : null}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Generated statements</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => loadData()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {statements.length === 0 ? (
                <p className="text-sm text-ink/40">No statements generated yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Payment month</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total payout</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statements.map((s) => (
                      <TableRow key={s.statement_id}>
                        <TableCell className="text-ink">{s.label}</TableCell>
                        <TableCell className="text-sm text-ink/70">
                          {s.payment_month
                            ? formatPaymentMonthLabel(s.payment_month)
                            : `${formatDate(s.period_start)} – ${formatDate(s.period_end)}`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={["final", "sent"].includes(s.status) ? "default" : "secondary"}
                            className={
                              ["final", "sent"].includes(s.status)
                                ? "bg-emerald-100 text-emerald-700"
                                : undefined
                            }
                          >
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-ink">
                          {formatMoney(Number(s.net_to_client_total))}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-accent"
                            onClick={() => loadStatementDetail(s.statement_id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedStatementId && (
        <div className="mt-8 space-y-4 print:mt-0 print:space-y-0" id="statement-preview">
          <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
            <div>
              <h2 className="font-sans text-xl font-semibold text-ink">Statement preview</h2>
              <p className="mt-1 text-sm text-ink/60">Review before publishing or printing to PDF.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["draft", "sent"].includes(String(statementDetail?.statement.status ?? "")) && (
                <Button variant="outline" onClick={() => setSendDialogOpen(true)}>
                  <Mail className="h-4 w-4" />
                  Publish &amp; send
                </Button>
              )}
              <Button onClick={handlePrint}>
                <Download className="h-4 w-4" />
                Print / Save PDF
              </Button>
            </div>
          </div>
          <Card id="statement-print-root" className="print:border-0 print:shadow-none">
            <CardContent className="pt-6 print:p-0 print:pt-4">
              {loadingDetail ? (
                <div className="flex items-center py-8 text-ink/50">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading…
                </div>
              ) : statementDetail ? (
                <StatementView
                  statement={{
                    ...(statementDetail.statement as Parameters<typeof StatementView>[0]["statement"]),
                    productionCompanyName: statementDetail.productionCompanyName ?? undefined,
                  }}
                  lines={statementDetail.lines}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="print:hidden">
          <DialogHeader>
            <DialogTitle>Publish statement</DialogTitle>
            <DialogDescription>
              Publishes this statement to My Statements for the production company. Optionally email
              the contact with the statement PDF attached.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sendEmailEnabled}
                onCheckedChange={(v) => setSendEmailEnabled(v === true)}
              />
              Send notification email with PDF attachment
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sendIncludePortalUsers}
                onCheckedChange={(v) => setSendIncludePortalUsers(v === true)}
                disabled={!sendEmailEnabled}
              />
              CC portal users at linked production company
            </label>

            {sendEmailEnabled ? (
              <div className="space-y-2 rounded-md border border-ink/10 bg-ink/[0.02] p-3 text-sm">
                <p className="text-xs font-medium text-ink/60">Email preview</p>
                {loadingRecipients ? (
                  <div className="flex items-center text-xs text-ink/40">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Looking up contacts…
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xs text-ink/40">To</p>
                      <p className="text-ink/80">
                        {recipientPreview?.to?.length
                          ? recipientPreview.to.join(", ")
                          : "No primary contact on file"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink/40">CC</p>
                      <p className="text-ink/80">
                        {recipientPreview?.cc?.length ? recipientPreview.cc.join(", ") : "None"}
                      </p>
                    </div>
                    {!recipientPreview?.to?.length ? (
                      <p className="text-xs text-amber-600">
                        Add a primary email in Settings → Statement contacts before sending.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                isSending || (sendEmailEnabled && !loadingRecipients && !recipientPreview?.to?.length)
              }
              onClick={handleSendStatement}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
