"use client"

import { useEffect, useState } from "react"
import { client, CONTRACT_ADDRESS, explorerAddressUrl } from "@/lib/genlayer"
import { ContractEvent, EventKind } from "@/lib/types"
import {
  AlertTriangle,
  ArrowDownToLine,
  BadgeCheck,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileSignature,
  Gavel,
  History,
  Play,
  Scale,
  Siren,
} from "lucide-react"
import { format } from "date-fns"

type EventStyle = {
  label: string
  className: string
  dotClass: string
  icon: React.ComponentType<{ className?: string }>
}

const EVENT_STYLES: Record<EventKind, EventStyle> = {
  nda_created: {
    label: "NDA created",
    className: "text-blue-800 dark:text-blue-200",
    dotClass: "bg-blue-500",
    icon: FileSignature,
  },
  nda_activated: {
    label: "NDA activated",
    className: "text-emerald-800 dark:text-emerald-200",
    dotClass: "bg-emerald-500",
    icon: Play,
  },
  nda_cancelled: {
    label: "NDA cancelled",
    className: "text-slate-700 dark:text-slate-300",
    dotClass: "bg-slate-400",
    icon: Ban,
  },
  leak_reported: {
    label: "Leak reported",
    className: "text-amber-800 dark:text-amber-200",
    dotClass: "bg-amber-500",
    icon: Siren,
  },
  violation_confirmed: {
    label: "Violation confirmed",
    className: "text-rose-800 dark:text-rose-200",
    dotClass: "bg-rose-500",
    icon: AlertTriangle,
  },
  appeal_filed: {
    label: "Appeal filed",
    className: "text-purple-800 dark:text-purple-200",
    dotClass: "bg-purple-500",
    icon: Scale,
  },
  appeal_overturned: {
    label: "Appeal overturned",
    className: "text-emerald-800 dark:text-emerald-200",
    dotClass: "bg-emerald-500",
    icon: CheckCircle2,
  },
  appeal_upheld: {
    label: "Appeal upheld",
    className: "text-rose-800 dark:text-rose-200",
    dotClass: "bg-rose-500",
    icon: Gavel,
  },
  verdict_finalized: {
    label: "Verdict finalized",
    className: "text-blue-800 dark:text-blue-200",
    dotClass: "bg-blue-500",
    icon: BadgeCheck,
  },
  nda_expired: {
    label: "NDA expired",
    className: "text-slate-700 dark:text-slate-300",
    dotClass: "bg-slate-400",
    icon: CalendarClock,
  },
  withdraw: {
    label: "Withdraw",
    className: "text-slate-700 dark:text-slate-300",
    dotClass: "bg-slate-400",
    icon: ArrowDownToLine,
  },
  publisher_registered: {
    label: "Publisher registered",
    className: "text-indigo-800 dark:text-indigo-200",
    dotClass: "bg-indigo-500",
    icon: BadgeCheck,
  },
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatMeta(kind: EventKind, meta: Record<string, unknown>): string[] {
  const lines: string[] = []
  const asStr = (v: unknown) => (v == null ? "" : String(v))
  const asBigInt = (v: unknown) => {
    try {
      return BigInt(asStr(v))
    } catch {
      return 0n
    }
  }
  const gen = (wei: unknown) => {
    const n = asBigInt(wei)
    if (n === 0n) return "0 GEN"
    const whole = n / 10n ** 18n
    const frac = ((n % 10n ** 18n) * 1000n) / 10n ** 18n
    return `${whole}.${frac.toString().padStart(3, "0")} GEN`
  }
  switch (kind) {
    case "nda_created":
      if (meta.scope) lines.push(`Scope: ${asStr(meta.scope)}`)
      if (meta.stake) lines.push(`Party A stake: ${gen(meta.stake)}`)
      if (meta.counterparty) lines.push(`Counterparty: ${shortAddr(asStr(meta.counterparty))}`)
      break
    case "nda_activated":
      if (meta.stake_b) lines.push(`Party B stake: ${gen(meta.stake_b)}`)
      break
    case "nda_cancelled":
      if (meta.refund) lines.push(`Refund: ${gen(meta.refund)}`)
      break
    case "leak_reported":
      if (meta.verdict) lines.push(`Verdict: ${asStr(meta.verdict)}`)
      if (meta.sources_confirming != null && meta.sources_evaluated != null)
        lines.push(`Sources confirming: ${asStr(meta.sources_confirming)}/${asStr(meta.sources_evaluated)}`)
      if (meta.suspect_url) lines.push(`URL: ${asStr(meta.suspect_url).slice(0, 80)}`)
      break
    case "violation_confirmed":
      if (meta.slashed) lines.push(`Slashed: ${gen(meta.slashed)}`)
      if (meta.reporter) lines.push(`Reporter: ${shortAddr(asStr(meta.reporter))}`)
      if (meta.reporter_reward_escrow) lines.push(`Reward escrow: ${gen(meta.reporter_reward_escrow)}`)
      break
    case "appeal_filed":
      if (meta.appeal_ground) lines.push(`Ground: ${asStr(meta.appeal_ground)}`)
      if (meta.appeal_stake) lines.push(`Appeal stake: ${gen(meta.appeal_stake)}`)
      if (meta.evidence_url) lines.push(`Evidence: ${asStr(meta.evidence_url).slice(0, 80)}`)
      break
    case "appeal_overturned":
      if (meta.restored_collateral) lines.push(`Restored: ${gen(meta.restored_collateral)}`)
      if (meta.appeal_fee_refunded) lines.push(`Fee refunded: ${gen(meta.appeal_fee_refunded)}`)
      break
    case "appeal_upheld":
      if (meta.appeal_fee_burned_to_treasury) lines.push(`Fee burned: ${gen(meta.appeal_fee_burned_to_treasury)}`)
      if (meta.verdict) lines.push(`Verdict: ${asStr(meta.verdict)}`)
      break
    case "verdict_finalized":
      if (meta.reporter_reward) lines.push(`Reporter reward: ${gen(meta.reporter_reward)}`)
      if (meta.compensation) lines.push(`Compensation: ${gen(meta.compensation)}`)
      if (meta.treasury_fee) lines.push(`Treasury: ${gen(meta.treasury_fee)}`)
      break
    case "nda_expired":
      if (meta.refund_a) lines.push(`Party A refund: ${gen(meta.refund_a)}`)
      if (meta.refund_b) lines.push(`Party B refund: ${gen(meta.refund_b)}`)
      break
    case "withdraw":
      if (meta.amount) lines.push(`Amount: ${gen(meta.amount)}`)
      break
    case "publisher_registered":
      if (meta.handle) lines.push(`Handle: ${asStr(meta.handle)}`)
      if (meta.proof_url) lines.push(`Proof: ${asStr(meta.proof_url).slice(0, 80)}`)
      break
  }
  return lines
}

export function EventTimeline({ ndaId }: { ndaId: string }) {
  const [events, setEvents] = useState<ContractEvent[] | null>(null)
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
        const parsed = JSON.parse(raw) as ContractEvent[]
        setEvents(parsed)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [ndaId])

  if (error) {
    return (
      <div className="text-sm text-slate-500">
        Event log unavailable ({error.slice(0, 120)}).
      </div>
    )
  }

  if (!events) {
    return (
      <div className="text-sm text-slate-500 animate-pulse">
        Loading on-chain event log…
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No on-chain events recorded for this NDA yet.
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-800" />
      <ul className="space-y-4">
        {events.map((ev) => {
          const style = EVENT_STYLES[ev.kind] ?? {
            label: ev.kind,
            className: "text-slate-700 dark:text-slate-300",
            dotClass: "bg-slate-400",
            icon: History,
          }
          const Icon = style.icon
          let meta: Record<string, unknown> = {}
          try {
            const parsed = JSON.parse(ev.meta_json || "{}")
            if (parsed && typeof parsed === "object") meta = parsed as Record<string, unknown>
          } catch {
            /* leave meta empty */
          }
          const lines = formatMeta(ev.kind, meta)
          const ts = Number(ev.timestamp)
          const when = ts > 0 ? format(new Date(ts * 1000), "PPp") : "—"
          return (
            <li key={ev.seq} className="relative pl-10">
              <span
                className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-950 ${style.dotClass} text-white`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className={`font-semibold ${style.className}`}>{style.label}</span>
                <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {when}
                </span>
                <span className="text-xs text-slate-400">seq #{ev.seq}</span>
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Actor:{" "}
                <a
                  href={explorerAddressUrl(ev.actor)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono underline decoration-dotted"
                >
                  {shortAddr(ev.actor)}
                </a>
              </div>
              {lines.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
