import {
  fetchProtocolStats,
  fetchEventBreakdown,
} from "@/lib/onchain-stats"
import { AnalyticsCharts } from "@/components/AnalyticsCharts"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Analytics — NDA Sentinel",
  description:
    "On-chain protocol analytics for NDA Sentinel on GenLayer studionet.",
}

export const dynamic = "force-dynamic"
export const revalidate = 60

export default async function AnalyticsPage() {
  const [stats, eventBreakdown] = await Promise.all([
    fetchProtocolStats(),
    fetchEventBreakdown(),
  ])

  const totalAppeals = stats.appealsOverturned + stats.appealsUpheld
  const appealOverturnRate =
    totalAppeals > 0
      ? Math.round((stats.appealsOverturned / totalAppeals) * 100)
      : 0
  const detectionRate =
    stats.totalNdas > 0
      ? Math.round((stats.violationsConfirmed / stats.totalNdas) * 100)
      : 0

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Protocol analytics</h1>
        <p className="text-slate-500 text-sm mt-1">
          Live on-chain data from NDA Sentinel on studionet
          {stats.live && (
            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse align-middle" />
          )}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total NDAs" value={stats.totalNdas} />
        <StatCard
          label="Violations confirmed"
          value={stats.violationsConfirmed}
          accent="rose"
        />
        <StatCard
          label="Value slashed"
          value={`${stats.totalSlashedGen} GEN`}
          accent="amber"
        />
        <StatCard
          label="Treasury"
          value={`${stats.treasuryGen} GEN`}
          accent="emerald"
        />
      </div>

      {/* Protocol health */}
      <div className="grid md:grid-cols-3 gap-4">
        <HealthCard
          label="Detection rate"
          value={`${detectionRate}%`}
          description="Violations per total NDAs"
        />
        <HealthCard
          label="Appeal overturn rate"
          value={`${appealOverturnRate}%`}
          description={`${stats.appealsOverturned} overturned / ${totalAppeals} total`}
        />
        <HealthCard
          label="On-chain events"
          value={stats.events}
          description="Total state transitions logged"
        />
      </div>

      {/* Charts (client component) */}
      <AnalyticsCharts
        eventBreakdown={eventBreakdown}
        stats={{
          reportFeesGen: stats.reportFeesGen,
          appealsUpheld: stats.appealsUpheld,
          appealsOverturned: stats.appealsOverturned,
        }}
      />

      {/* Data freshness */}
      <p className="text-xs text-slate-400 text-center">
        Data fetched from studionet RPC at{" "}
        {new Date(stats.fetchedAt).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        . Refreshes every 60 s.
      </p>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: "rose" | "amber" | "emerald"
}) {
  const border =
    accent === "rose"
      ? "border-rose-200 dark:border-rose-900/50"
      : accent === "amber"
        ? "border-amber-200 dark:border-amber-900/50"
        : accent === "emerald"
          ? "border-emerald-200 dark:border-emerald-900/50"
          : "border-slate-200 dark:border-slate-800"
  return (
    <div
      className={`rounded-xl border ${border} bg-white dark:bg-slate-900/40 p-5`}
    >
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold font-mono">{value}</p>
    </div>
  )
}

function HealthCard({
  label,
  value,
  description,
}: {
  label: string
  value: string | number
  description: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{description}</p>
    </div>
  )
}
