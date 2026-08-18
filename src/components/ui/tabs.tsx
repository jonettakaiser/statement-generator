"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  value: string
  setValue: (v: string) => void
} | null>(null)

export function Tabs({
  defaultValue,
  className,
  children,
}: {
  defaultValue: string
  className?: string
  children: React.ReactNode
}) {
  const [value, setValue] = React.useState(defaultValue)
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("inline-flex items-center gap-1 rounded-lg border border-ink/10 bg-white p-1", className)}
      {...props}
    />
  )
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs")
  const active = ctx.value === value
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-accent text-white" : "text-ink/60 hover:text-ink",
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("TabsContent must be used within Tabs")
  if (ctx.value !== value) return null
  return <div className={className}>{children}</div>
}
