"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

type FilmOption = {
  film_id: string
  title: string
  statement_contact_email: string | null
}

export function ProgramFilmPicker({
  films,
  value,
  onValueChange,
  placeholder,
}: {
  films: FilmOption[]
  value: string
  onValueChange: (filmId: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const selected = films.find((f) => f.film_id === value)
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return films
    return films.filter((f) => f.title.toLowerCase().includes(q))
  }, [films, query])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-ink/15 bg-white px-2.5 text-sm text-ink"
      >
        <span className={cn("truncate text-left", !selected && "text-ink/40")}>
          {selected ? selected.title : placeholder ?? "Search library…"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink/40" />
      </button>
      {open ? (
        <div className="absolute z-50 mt-1 w-72 max-w-[24rem] overflow-hidden rounded-md border border-ink/10 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-ink/10 px-2.5 py-2">
            <Search className="h-3.5 w-3.5 text-ink/40" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder ?? "Search library…"}
              className="w-full text-sm outline-none placeholder:text-ink/40"
            />
          </div>
          <div className="max-h-56 overflow-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2.5 py-2 text-sm text-ink/40">No matching titles.</p>
            ) : (
              filtered.map((film) => (
                <button
                  key={film.film_id}
                  type="button"
                  onClick={() => {
                    onValueChange(film.film_id)
                    setOpen(false)
                    setQuery("")
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-sm hover:bg-accent/10",
                    film.film_id === value && "bg-accent/5 text-accent"
                  )}
                >
                  <span className="truncate">{film.title}</span>
                  {film.film_id === value ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
