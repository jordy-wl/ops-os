interface MetricCardProps {
  label: string
  value: number | string
  sublabel?: string
}

/**
 * MetricCard — displays a single operational metric on the dashboard.
 * Shows a label, a prominent numeric value, and an optional sub-label.
 *
 * @param label    - Short descriptor (e.g. "Total Blocks")
 * @param value    - The metric value to display
 * @param sublabel - Optional supporting text (e.g. "in last 24h")
 */
export function MetricCard({ label, value, sublabel }: MetricCardProps) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-bold text-foreground tabular-nums">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  )
}
