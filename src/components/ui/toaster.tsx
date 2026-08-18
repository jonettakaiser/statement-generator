"use client"

import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start justify-between gap-3 rounded-lg border p-4 shadow-lg",
            t.variant === "destructive"
              ? "border-rust bg-rust text-white"
              : "border-ink bg-ink text-white"
          )}
        >
          <div className="min-w-0 flex-1">
            {t.title ? <p className="text-sm font-semibold">{t.title}</p> : null}
            {t.description ? (
              <p className="mt-0.5 whitespace-pre-line text-xs text-white/80">{t.description}</p>
            ) : null}
          </div>
          {t.action}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="text-xs text-white/60 hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
