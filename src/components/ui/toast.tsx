"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export const ToastAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { altText: string }
>(({ className, altText, ...props }, ref) => (
  <button
    ref={ref}
    aria-label={altText}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = "ToastAction"
