"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts"
import type { EventBreakdown } from "@/lib/onchain-stats"

const BAR_COLORS: Record<string, string> = {
  nda_created: "#3b82f6",
  nda_activated: "#10b981",
  nda_cancelled: "#94a3b8",
  leak_reported: "#f59e0b",
  violation_confirmed: "#ef4444",
  appeal_filed: "#8b5cf6",
  appeal_overturned: "#22c55e",
  appeal_upheld: "#e11d48",
  verdict_finalized: "#6366f1",
  nda_expired: "#64748b",
  withdraw: "#78716c",
  publisher_registered: "#6366f1",
}

interface Props {
  eventBreakdown: EventBreakdown[]
  stats: {
    reportFeesGen: number
    appealsUpheld: number
    appealsOverturned: number
  }
}

export function AnalyticsCharts({ eventBreakdown, stats }: Props) {
  const hasEvents = eventBreakdown.length > 0
  const hasAppeals = stats.appealsUpheld + stats.appealsOverturned > 0

  const appealPieData = hasAppeals
    ? [
        { name: "Overturned", value: stats.appealsOverturned, fill: "#22c55e" },
        { name: "Upheld", value: stats.appealsUpheld, fill: "#e11d48" },
      ]
    : []

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Event breakdown bar chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Event breakdown
        </h2>
        {hasEvents ? (
          <ResponsiveContainer width="100%" height={Math.max(200, eventBreakdown.length * 36)}>
            <BarChart
              data={eventBreakdown}
              layout="vertical"
              margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
            >
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={150}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-slate-900, #0f172a)",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {eventBreakdown.map((entry) => (
                  <Cell
                    key={entry.kind}
                    fill={BAR_COLORS[entry.kind] || "#94a3b8"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 py-8 text-center">
            No events recorded yet.
          </p>
        )}
      </div>

      {/* Appeal outcome pie chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Appeal outcomes
        </h2>
        {hasAppeals ? (
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={appealPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {appealPieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-6 mt-2 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                Overturned
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-600 inline-block" />
                Upheld
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-sm">
            <p>No appeals resolved yet.</p>
            <p className="text-xs mt-1">
              Report fees collected: {stats.reportFeesGen} GEN
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
