"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type SelectContextValue = {
  value: string | undefined
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  registerLabel: (value: string, label: React.ReactNode) => void
  labels: Map<string, React.ReactNode>
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

export function Select({
  value,
  onValueChange,
  children,
}: {
  value: string | undefined
  onValueChange: (value: string) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const labelsRef = React.useRef(new Map<string, React.ReactNode>())
  const [, forceRender] = React.useState(0)

  const registerLabel = React.useCallback((v: string, label: React.ReactNode) => {
    if (labelsRef.current.get(v) !== label) {
      labelsRef.current.set(v, label)
      forceRender((n) => n + 1)
    }
  }, [])

  const rootRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  return (
    <SelectContext.Provider
      value={{ value, onValueChange, open, setOpen, registerLabel, labels: labelsRef.current }}
    >
      <div ref={rootRef} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

export function SelectTrigger({ className, children }: { className?: string; children: React.ReactNode }) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error("SelectTrigger must be used within Select")
  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className
      )}
    >
      {children}
      <ChevronDown className="h-4 w-4 text-ink/40" />
    </button>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error("SelectValue must be used within Select")
  const label = ctx.value ? ctx.labels.get(ctx.value) : undefined
  return (
    <span className={cn("truncate", !label && "text-ink/40")}>
      {label ?? placeholder ?? ""}
    </span>
  )
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error("SelectContent must be used within Select")
  return (
    <div
      className={cn(
        "absolute z-50 mt-1 max-h-64 w-full min-w-[10rem] overflow-auto rounded-md border border-ink/10 bg-white p-1 shadow-lg",
        ctx.open ? "block" : "hidden"
      )}
    >
      {children}
    </div>
  )
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error("SelectItem must be used within Select")

  React.useEffect(() => {
    ctx.registerLabel(value, children)
  }, [value, children, ctx])

  const selected = ctx.value === value
  return (
    <button
      type="button"
      onClick={() => {
        ctx.onValueChange(value)
        ctx.setOpen(false)
      }}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent/10",
        selected && "bg-accent/5 text-accent"
      )}
    >
      {children}
      {selected ? <Check className="h-3.5 w-3.5" /> : null}
    </button>
  )
}
