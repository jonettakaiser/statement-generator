// Triggers the browser print dialog. Print-only styles (globals.css) hide
// everything except #statement-print-root so "Save as PDF" produces a clean
// single-document statement.
export function printStatement() {
  window.print()
}
