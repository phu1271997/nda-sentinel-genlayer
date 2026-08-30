"use client"

import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Scale,
  Ban,
  CalendarClock,
} from "lucide-react"

type NDAStatus =
  | "pending"
  | "active"
  | "leaked"
  | "expired"
  | "cancelled"
  | "disputed"
  | "appeal_pending"

interface Step {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const LIFECYCLE_STEPS: Step[] = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "active", label: "Active", icon: CheckCircle2 },
  { key: "leaked", label: "Reported", icon: AlertTriangle },
  { key: "disputed", label: "Appealed", icon: Scale },
  { key: "finalized", label: "Finalized", icon: CheckCircle2 },
]

function stepIndex(status: NDAStatus): number {
  switch (status) {
    case "pending":
      return 0
    case "active":
      return 1
    case "leaked":
      return 2
    case "disputed":
    case "appeal_pending":
      return 3
    case "expired":
    case "cancelled":
      return -1
    default:
      return 0
  }
}

function terminalLabel(status: NDAStatus): {
  label: string
  icon: React.ComponentType<{ className?: string }>
} | null {
  if (status === "expired")
    return { label: "Expired", icon: CalendarClock }
  if (status === "cancelled")
    return { label: "Cancelled", icon: Ban }
  return null
}

export function NDALifecycleStepper({ status }: { status: NDAStatus }) {
  const current = stepIndex(status)
  const terminal = terminalLabel(status)

  if (terminal) {
    const TermIcon = terminal.icon
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
        <TermIcon className="w-5 h-5 text-slate-400" />
        <span className="text-sm font-medium text-slate-500">
          {terminal.label}
        </span>
        <span className="text-xs text-slate-400 ml-auto">
          Terminal state — no further transitions
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-0 overflow-x-auto py-3"
      role="list"
      aria-label="NDA lifecycle progress"
    >
      {LIFECYCLE_STEPS.map((step, i) => {
        const Icon = step.icon
        const isActive = i === current
        const isPast = i < current
        const isFuture = i > current

        return (
          <div key={step.key} className="flex items-center" role="listitem">
            {i > 0 && (
              <div
                className={`h-0.5 w-6 sm:w-10 ${
                  isPast
                    ? "bg-purple-500"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
            <div
              className={`flex flex-col items-center gap-1 ${
                isActive ? "scale-110" : ""
              } transition-transform`}
            >
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-colors ${
                  isActive
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-600"
                    : isPast
                      ? "border-purple-500 bg-purple-500 text-white"
                      : "border-slate-300 dark:border-slate-600 text-slate-400"
                }`}
              >
                {isPast ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isFuture ? (
                  <Circle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isActive
                    ? "font-semibold text-purple-600 dark:text-purple-400"
                    : isPast
                      ? "text-slate-600 dark:text-slate-300"
                      : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
