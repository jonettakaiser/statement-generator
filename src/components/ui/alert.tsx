import * as React from "react"
import { cn } from "@/lib/utils"

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn("rounded-lg border px-4 py-3", className)}
      {...props}
    />
  )
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-relaxed", className)} {...props} />
}
