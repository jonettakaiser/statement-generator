// Payment months are stored as "YYYY-MM" strings (matches <input type="month">).
export function formatPaymentMonthLabel(paymentMonth: string): string {
  const [year, month] = paymentMonth.split("-").map(Number)
  if (!year || !month) return paymentMonth
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}
