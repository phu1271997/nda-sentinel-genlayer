"use client"

import {
  Award,
  BadgeCheck,
  Fingerprint,
  Flame,
  Gavel,
  Lock,
  Medal,
  ShieldCheck,
  Sparkles,
  Trophy,
  Star,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type BadgeCode =
  | "first_nda"
  | "first_activation"
  | "first_report"
  | "confirmed_hunter"
  | "appeal_champion"
  | "verified_publisher"
  | "encrypted_adopter"
  | "slashed_whale"
  | "settler"
  | "reputation_elite"

export interface UserBadge {
  code: BadgeCode | string
  tier: number
  earned_at: number
}

const REGISTRY: Record<
  string,
  { title: string; description: string; icon: React.ComponentType<{ className?: string }>; accent: string }
> = {
  first_nda: {
    title: "First NDA",
    description: "Created your first NDA on GenLayer.",
    icon: Star,
    accent: "from-blue-500 to-indigo-500",
  },
  first_activation: {
    title: "First Handshake",
    description: "Activated an incoming NDA as party B.",
    icon: BadgeCheck,
    accent: "from-cyan-500 to-blue-500",
  },
  first_report: {
    title: "First Report",
    description: "Submitted your first leak report through consensus.",
    icon: Flame,
    accent: "from-orange-500 to-rose-500",
  },
  confirmed_hunter: {
    title: "Confirmed Hunter",
    description: "Leak reports the AI Jury confirmed. Tiers at 1 / 5 / 10 / 25.",
    icon: Award,
    accent: "from-amber-500 to-red-500",
  },
  appeal_champion: {
    title: "Appeal Champion",
    description: "Overturned an unjust verdict. Tiers at 1 / 3 / 5.",
    icon: Gavel,
    accent: "from-emerald-500 to-teal-500",
  },
  verified_publisher: {
    title: "Verified Publisher",
    description: "Proved an out-of-band identity for attribution.",
    icon: Fingerprint,
    accent: "from-fuchsia-500 to-purple-500",
  },
  encrypted_adopter: {
    title: "Encrypted Adopter",
    description: "Created your first end-to-end encrypted NDA.",
    icon: Lock,
    accent: "from-emerald-500 to-lime-500",
  },
  slashed_whale: {
    title: "Slasher",
    description: "Total slashed via your reports. Tiers at 10 / 100 / 1000 GEN.",
    icon: ShieldCheck,
    accent: "from-rose-500 to-pink-500",
  },
  settler: {
    title: "Settler",
    description: "Kept the queue clean by finalizing verdicts. Tiers at 3 / 5 / 10.",
    icon: Medal,
    accent: "from-slate-500 to-slate-700",
  },
  reputation_elite: {
    title: "Reputation Elite",
    description: "Reached a reputation score of 1300+.",
    icon: Trophy,
    accent: "from-yellow-400 to-amber-500",
  },
}

function tierLabel(tier: number): string {
  if (tier >= 4) return "Platinum"
  if (tier >= 3) return "Gold"
  if (tier >= 2) return "Silver"
  if (tier >= 1) return "Bronze"
  return "—"
}

export function BadgePill({ b }: { b: UserBadge }) {
  const info = REGISTRY[b.code] ?? {
    title: b.code,
    description: "",
    icon: Sparkles,
    accent: "from-slate-500 to-slate-700",
  }
  const Icon = info.icon
  return (
    <div
      className={cn(
        "relative rounded-lg p-3 border bg-white dark:bg-slate-900 flex gap-3 items-start",
        "hover:shadow-md transition",
      )}
      title={info.description}
    >
      <div
        className={cn(
          "shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-white bg-gradient-to-br",
          info.accent,
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{info.title}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {tierLabel(b.tier)}
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
          {info.description}
        </p>
      </div>
    </div>
  )
}

export function BadgeGrid({ badges }: { badges: UserBadge[] }) {
  if (!badges || badges.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        No badges yet. Create an NDA, submit a leak report, register a
        publisher identity, or hit the reputation tier to earn your first
        one.
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {badges
        .slice()
        .sort((a, b) => b.tier - a.tier || b.earned_at - a.earned_at)
        .map((b, i) => (
          <BadgePill key={`${b.code}-${i}`} b={b} />
        ))}
    </div>
  )
}
