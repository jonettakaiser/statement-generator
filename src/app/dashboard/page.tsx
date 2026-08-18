"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase-client"
import { formatPaymentMonthLabel } from "@/lib/statements/payment-month"

type ClientStatement = {
  statement_id: string
  label: string
  payment_month: string | null
  period_start: string
  period_end: string
  status: string
  net_to_client_total: number
  sent_at: string | null
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0)
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [statements, setStatements] = useState<ClientStatement[]>([])

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }
      const { data } = await supabase
        .from("statements")
        .select("statement_id, label, payment_month, period_start, period_end, status, net_to_client_total, sent_at")
        .order("created_at", { ascending: false })
      setStatements(data ?? [])
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-ink/40">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="font-sans text-2xl font-semibold text-ink">My Statements</h1>
        <p className="mt-1 text-sm text-ink/60">Published revenue statements for your titles.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Statements</CardTitle>
          <CardDescription>Sorted by most recent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {statements.length === 0 ? (
            <p className="text-sm text-ink/50">No statements have been published yet.</p>
          ) : (
            statements.map((s) => (
              <div
                key={s.statement_id}
                className="flex items-center justify-between rounded-lg border border-ink/10 p-4"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium text-ink">{s.label}</p>
                    <p className="text-xs text-ink/50">
                      {s.payment_month ? formatPaymentMonthLabel(s.payment_month) : s.period_start}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink">{money(s.net_to_client_total)}</span>
                  <Badge variant={s.status === "final" ? "default" : "secondary"} className="capitalize">
                    {s.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
