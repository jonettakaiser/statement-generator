import * as React from "react"
import { cn } from "@/lib/utils"

export const ToastAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { altText: string }>(
  ({ className, altText, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={altText}
      className={cn(
        "shrink-0 rounded-md border border-white/30 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/10",
        className
      )}
      {...props}
    />
  )
)
ToastAction.displayName = "ToastAction"
