import { CONTRACT_ADDRESS, STUDIONET_RPC_URL } from "@/lib/genlayer"

export interface ProtocolStats {
  totalNdas: number
  violationsConfirmed: number
  appealsUpheld: number
  appealsOverturned: number
  totalSlashedWei: string
  totalSlashedGen: number
  treasuryWei: string
  treasuryGen: number
  reportFeesWei: string
  reportFeesGen: number
  events: number
  live: boolean
  fetchedAt: string
}

const FALLBACK: ProtocolStats = {
  totalNdas: 0,
  violationsConfirmed: 0,
  appealsUpheld: 0,
  appealsOverturned: 0,
  totalSlashedWei: "0",
  totalSlashedGen: 0,
  treasuryWei: "0",
  treasuryGen: 0,
  reportFeesWei: "0",
  reportFeesGen: 0,
  events: 0,
  live: false,
  fetchedAt: new Date().toISOString(),
}

function toGen(weiStr: string): number {
  try {
    const wei = BigInt(weiStr || "0")
    // fixed to 3 decimal places, safe for display
    const scaled = Number((wei * 1000n) / 1_000_000_000_000_000_000n)
    return scaled / 1000
  } catch {
    return 0
  }
}

async function callView(method: string): Promise<unknown> {
  const res = await fetch(STUDIONET_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "gen_call",
      params: [
        {
          to: CONTRACT_ADDRESS,
          data: {
            method,
            args: [],
          },
        },
        "latest",
      ],
    }),
    cache: "no-store",
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`RPC ${res.status}`)
  const body = await res.json()
  if (body.error) throw new Error(String(body.error.message || body.error))
  return body.result
}

async function callViewWithArgs(method: string, args: unknown[]): Promise<unknown> {
  const res = await fetch(STUDIONET_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "gen_call",
      params: [
        {
          to: CONTRACT_ADDRESS,
          data: {
            method,
            args,
          },
        },
        "latest",
      ],
    }),
    cache: "no-store",
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`RPC ${res.status}`)
  const body = await res.json()
  if (body.error) throw new Error(String(body.error.message || body.error))
  return body.result
}

export interface EventBreakdown {
  kind: string
  count: number
  label: string
}

const EVENT_LABELS: Record<string, string> = {
  nda_created: "NDAs created",
  nda_activated: "NDAs activated",
  nda_cancelled: "NDAs cancelled",
  leak_reported: "Leaks reported",
  violation_confirmed: "Violations confirmed",
  appeal_filed: "Appeals filed",
  appeal_overturned: "Appeals overturned",
  appeal_upheld: "Appeals upheld",
  verdict_finalized: "Verdicts finalized",
  nda_expired: "NDAs expired",
  withdraw: "Withdrawals",
  publisher_registered: "Publishers registered",
}

export async function fetchEventBreakdown(): Promise<EventBreakdown[]> {
  try {
    const countRaw = await callView("get_events_count")
    const count = Number(
      typeof countRaw === "string" || typeof countRaw === "number"
        ? countRaw
        : (countRaw as { toString?: () => string })?.toString?.() ?? 0,
    )
    if (!Number.isFinite(count) || count === 0) return []

    const limit = Math.min(count, 200)
    const eventsRaw = await callViewWithArgs("get_events", [0, limit])
    const eventsStr =
      typeof eventsRaw === "string" ? eventsRaw : JSON.stringify(eventsRaw)
    const events = JSON.parse(eventsStr) as { kind: string }[]

    const counts: Record<string, number> = {}
    for (const ev of events) {
      counts[ev.kind] = (counts[ev.kind] || 0) + 1
    }

    return Object.entries(counts)
      .map(([kind, c]) => ({
        kind,
        count: c,
        label: EVENT_LABELS[kind] || kind.replace(/_/g, " "),
      }))
      .sort((a, b) => b.count - a.count)
  } catch {
    return []
  }
}

export async function fetchProtocolStats(): Promise<ProtocolStats> {
  try {
    const [statsRaw, eventsRaw] = await Promise.all([
      callView("get_stats"),
      callView("get_events_count"),
    ])
    const statsStr = typeof statsRaw === "string" ? statsRaw : JSON.stringify(statsRaw)
    const parsed = JSON.parse(statsStr) as Record<string, string>
    const eventsCount = Number(
      typeof eventsRaw === "string" || typeof eventsRaw === "number"
        ? eventsRaw
        : (eventsRaw as { toString?: () => string })?.toString?.() ?? 0
    )
    const slashed = parsed.total_value_slashed || "0"
    const treasury = parsed.treasury || "0"
    const reportFees = parsed.total_report_fees_collected || "0"
    return {
      totalNdas: Number(parsed.total_ndas_created || 0),
      violationsConfirmed: Number(parsed.total_violations_confirmed || 0),
      appealsUpheld: Number(parsed.total_appeals_upheld || 0),
      appealsOverturned: Number(parsed.total_appeals_overturned || 0),
      totalSlashedWei: slashed,
      totalSlashedGen: toGen(slashed),
      treasuryWei: treasury,
      treasuryGen: toGen(treasury),
      reportFeesWei: reportFees,
      reportFeesGen: toGen(reportFees),
      events: Number.isFinite(eventsCount) ? eventsCount : 0,
      live: true,
      fetchedAt: new Date().toISOString(),
    }
  } catch {
    return { ...FALLBACK, fetchedAt: new Date().toISOString() }
  }
}
