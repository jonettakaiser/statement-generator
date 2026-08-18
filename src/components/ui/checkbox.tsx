"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Checkbox({ checked, onCheckedChange, disabled, className }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-accent bg-accent text-white" : "border-ink/25 bg-white",
        className
      )}
    >
      {checked ? <Check className="h-3 w-3" /> : null}
    </button>
  )
}
