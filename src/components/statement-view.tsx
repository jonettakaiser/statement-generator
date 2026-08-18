import { formatPaymentMonthLabel } from "@/lib/statements/payment-month"

type StatementLine = {
  line_id: string
  program_name: string
  platform: string
  gross: number
  client_share_pct: number
  distributor_share_pct: number
  distribution_fee: number
  net_to_client: number
}

type StatementForView = {
  statement_id: string
  label: string
  payment_month?: string | null
  period_start: string
  period_end: string
  status: string
  gross_total: number
  distribution_fee_total: number
  net_to_client_total: number
  created_at: string
  productionCompanyName?: string
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0)
}

function date(d: string) {
  if (!d) return "—"
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function StatementView({
  statement,
  lines,
}: {
  statement: StatementForView
  lines: StatementLine[]
}) {
  return (
    <div className="space-y-8 font-sans text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Revenue statement</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{statement.productionCompanyName ?? statement.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {statement.payment_month
              ? formatPaymentMonthLabel(statement.payment_month)
              : `${date(statement.period_start)} – ${date(statement.period_end)}`}
          </p>
        </div>
        <div className="text-right text-sm text-ink/60">
          <p>Statement #{statement.statement_id.slice(0, 8).toUpperCase()}</p>
          <p>Issued {date(statement.created_at.slice(0, 10))}</p>
          <p className="capitalize">Status: {statement.status}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs font-semibold uppercase tracking-wide text-ink/50">
              <th className="py-2 pr-3">Program</th>
              <th className="py-2 pr-3">Platform</th>
              <th className="py-2 pr-3 text-right">Gross</th>
              <th className="py-2 pr-3 text-right">Split</th>
              <th className="py-2 pr-3 text-right">Distribution fee</th>
              <th className="py-2 text-right">Net to client</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.line_id} className="border-b border-ink/5">
                <td className="py-2 pr-3">{line.program_name}</td>
                <td className="py-2 pr-3 text-ink/60">{line.platform}</td>
                <td className="py-2 pr-3 text-right">{money(line.gross)}</td>
                <td className="py-2 pr-3 text-right text-ink/60">
                  {Math.round(line.client_share_pct * 100)}/{Math.round(line.distributor_share_pct * 100)}
                </td>
                <td className="py-2 pr-3 text-right">{money(line.distribution_fee)}</td>
                <td className="py-2 text-right font-medium">{money(line.net_to_client)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto max-w-xs space-y-2 border-t border-ink/10 pt-4 text-sm">
        <div className="flex justify-between text-ink/60">
          <span>Gross total</span>
          <span>{money(statement.gross_total)}</span>
        </div>
        <div className="flex justify-between text-ink/60">
          <span>Distribution fee</span>
          <span>{money(statement.distribution_fee_total)}</span>
        </div>
        <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-semibold">
          <span>Net to client</span>
          <span>{money(statement.net_to_client_total)}</span>
        </div>
      </div>
    </div>
  )
}
