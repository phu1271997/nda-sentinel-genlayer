"use client"

import { useEffect, useState } from "react"
import { client, CONTRACT_ADDRESS } from "@/lib/genlayer"
import { ContractEvent } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, HelpCircle, AlertTriangle } from "lucide-react"
import { format } from "date-fns"

type LeakEntry = {
  seq: string
  timestamp: string
  suspect_url: string
  verdict: string
  sources_confirming?: number
  sources_evaluated?: number
}

const VERDICT_STYLE: Record<
  string,
  { label: string; className: string; iconClass: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  no_violation: {
    label: "No violation",
    className: "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/50",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  inconclusive: {
    label: "Inconclusive",
    className: "border-slate-200 bg-slate-50 dark:bg-slate-950/20 dark:border-slate-800",
    iconClass: "text-slate-500",
    Icon: HelpCircle,
  },
  violation_confirmed: {
    label: "Violation confirmed",
    className: "border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/50",
    iconClass: "text-rose-600 dark:text-rose-400",
    Icon: AlertTriangle,
  },
}

export function LeakHistoryPanel({ ndaId }: { ndaId: string }) {
  const [entries, setEntries] = useState<LeakEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const raw = (await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_events_for_nda",
          args: [BigInt(ndaId)],
        })) as string
        if (cancelled) return
        const events = JSON.parse(raw) as ContractEvent[]
        const reports = events
          .filter((e) => e.kind === "leak_reported")
          .map((e) => {
            let meta: Record<string, unknown> = {}
            try { meta = JSON.parse(e.meta_json || "{}") } catch { /* leave empty */ }
            return {
              seq: e.seq,
              timestamp: e.timestamp,
              suspect_url: String(meta.suspect_url ?? ""),
              verdict: String(meta.verdict ?? "unknown"),
              sources_confirming: meta.sources_confirming != null ? Number(meta.sources_confirming) : undefined,
              sources_evaluated: meta.sources_evaluated != null ? Number(meta.sources_evaluated) : undefined,
            } as LeakEntry
          })
        setEntries(reports)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    load()
    return () => { cancelled = true }
  }, [ndaId])

  if (error || entries === null || entries.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Past leak reports on this NDA</h3>
      {entries.map((entry) => {
        const style = VERDICT_STYLE[entry.verdict] ?? VERDICT_STYLE.inconclusive
        const Icon = style.Icon
        const ts = Number(entry.timestamp)
        const when = ts > 0 ? format(new Date(ts * 1000), "PPp") : "—"
        return (
          <Card key={entry.seq} className={style.className}>
            <CardContent className="p-4 flex items-start gap-3">
              <Icon className={`w-5 h-5 mt-0.5 ${style.iconClass}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">AI Jury verdict: {style.label}</span>
                  <span className="text-xs text-slate-500">{when}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 break-all">
                  Suspect URL: <span className="font-mono">{entry.suspect_url}</span>
                </p>
                {entry.sources_evaluated != null && (
                  <p className="text-xs text-slate-500 mt-1">
                    Sources confirming: {entry.sources_confirming ?? 0}/{entry.sources_evaluated}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
