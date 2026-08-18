"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
      />
      {children}
    </div>,
    document.body
  )
}

export function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative z-10 w-full max-w-lg rounded-xl border border-ink/10 bg-white p-6 shadow-xl",
        className
      )}
    >
      {children}
    </div>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1.5", className)} {...props} />
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("font-sans text-lg font-semibold text-ink", className)} {...props} />
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-ink/60", className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />
}

export { X as DialogCloseIcon }
