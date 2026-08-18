"use client"

import * as React from "react"

export type ToastVariant = "default" | "destructive"

export type ToastItem = {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  action?: React.ReactNode
}

type ToastInput = Omit<ToastItem, "id">

const TOAST_DURATION_MS = 6000

let listeners: Array<(toasts: ToastItem[]) => void> = []
let memoryToasts: ToastItem[] = []

function emit() {
  listeners.forEach((listener) => listener(memoryToasts))
}

function dismiss(id: string) {
  memoryToasts = memoryToasts.filter((t) => t.id !== id)
  emit()
}

function toast(input: ToastInput) {
  const id = Math.random().toString(36).slice(2)
  memoryToasts = [...memoryToasts, { ...input, id }]
  emit()
  setTimeout(() => dismiss(id), TOAST_DURATION_MS)
  return id
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>(memoryToasts)

  React.useEffect(() => {
    listeners.push(setToasts)
    return () => {
      listeners = listeners.filter((l) => l !== setToasts)
    }
  }, [])

  return { toasts, toast, dismiss }
}
