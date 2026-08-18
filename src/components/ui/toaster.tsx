"use client"

import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border bg-card p-4 text-sm shadow-lg",
            t.variant === "destructive"
              ? "border-destructive/30 bg-destructive text-destructive-foreground"
              : "border-border text-foreground"
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            {t.title ? <p className="font-medium leading-none">{t.title}</p> : null}
            {t.description ? (
              <p
                className={cn(
                  "whitespace-pre-line text-xs",
                  t.variant === "destructive" ? "text-destructive-foreground/80" : "text-muted-foreground"
                )}
              >
                {t.description}
              </p>
            ) : null}
          </div>
          {t.action}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="rounded-sm text-current opacity-60 transition-opacity hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
