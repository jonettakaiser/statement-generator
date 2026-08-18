"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Loader2, Plus, Search } from "lucide-react"
import { bseFilmSearchHaystack } from "@/lib/statements/bse-film-catalog"
import { normalizeProgramName, uniqueByNormalizedTitle } from "@/lib/statements/csv"
import { cn } from "@/lib/utils"

type FilmOption = {
  film_id: string
  title: string
  statement_contact_email: string | null
  production_company_id?: string | null
}

export function ProgramFilmPicker({
  films,
  value,
  onValueChange,
  onCreateFilm,
  suggestedName,
  placeholder,
}: {
  films: FilmOption[]
  value: string
  onValueChange: (filmId: string) => void
  onCreateFilm?: (title: string) => Promise<FilmOption>
  suggestedName?: string
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 288 })
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const updatePosition = React.useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = Math.max(rect.width, 288)
    const left = Math.min(rect.left, window.innerWidth - width - 8)
    setCoords({
      top: rect.bottom + 4,
      left: Math.max(8, left),
      width,
    })
  }, [])

  React.useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
      setQuery("")
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  React.useEffect(() => {
    if (!open) return
    updatePosition()
    inputRef.current?.focus()
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [open, updatePosition])

  const library = React.useMemo(() => uniqueByNormalizedTitle(films), [films])
  const selected = library.find((f) => f.film_id === value)
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return library
    return library.filter((f) => bseFilmSearchHaystack(f.title).toLowerCase().includes(q))
  }, [library, query])

  const createTitle = query.trim() || suggestedName?.trim() || ""
  const createNormalized = normalizeProgramName(createTitle)
  const alreadyInLibrary = library.some(
    (film) => normalizeProgramName(film.title) === createNormalized
  )
  const canCreate = Boolean(onCreateFilm && createTitle && !alreadyInLibrary)

  const selectFilm = (filmId: string) => {
    onValueChange(filmId)
    setOpen(false)
    setQuery("")
  }

  const createFilm = async (title: string) => {
    if (!onCreateFilm || !title.trim() || creating) return
    setCreating(true)
    try {
      const film = await onCreateFilm(title.trim())
      selectFilm(film.film_id)
    } catch {
      // Parent surfaces the error.
    } finally {
      setCreating(false)
    }
  }

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          style={{ top: coords.top, left: coords.left, width: coords.width }}
          className="fixed z-[200] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <div className="flex items-center gap-2 border-b px-2.5 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) {
                  e.preventDefault()
                  void createFilm(createTitle)
                }
              }}
              placeholder={placeholder ?? "Search or type a new title…"}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-56 overflow-auto p-1">
            {canCreate ? (
              <button
                type="button"
                disabled={creating}
                onClick={() => void createFilm(createTitle)}
                className="mb-1 flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-primary hover:bg-muted"
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">Add “{createTitle}” to library</span>
              </button>
            ) : null}
            {filtered.length === 0 && !canCreate ? (
              <p className="px-2.5 py-2 text-sm text-muted-foreground">No matching titles.</p>
            ) : (
              filtered.map((film) => (
                <button
                  key={film.film_id}
                  type="button"
                  onClick={() => selectFilm(film.film_id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                    film.film_id === value && "bg-muted font-medium"
                  )}
                >
                  <span className="truncate">{film.title}</span>
                  {film.film_id === value ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-sm"
      >
        <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
          {selected ? selected.title : placeholder ?? "Search or add…"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {menu}
    </div>
  )
}
