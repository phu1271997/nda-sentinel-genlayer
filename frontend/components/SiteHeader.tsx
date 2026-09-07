"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle, Award, BadgeCheck, BarChart3, Coins, Eye, Handshake, KeyRound, LucideIcon, Menu, Shield, Trophy, Users, X } from "lucide-react"
import { useEffect, useState } from "react"
import { InboxBell } from "./InboxBell"

type NavItem = {
  href: string
  label: string
  accent?: "rose" | "emerald"
  icon?: LucideIcon
}

const NAV: NavItem[] = [
  { href: "/ndas", label: "Dashboard" },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/report", label: "Report Leak", accent: "rose", icon: AlertTriangle },
  { href: "/identity", label: "Identity", accent: "emerald", icon: BadgeCheck },
  { href: "/keys", label: "Keys", accent: "emerald", icon: KeyRound },
  { href: "/violations", label: "Verdicts" },
  { href: "/badges", label: "Badges", icon: Award },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/bounties", label: "Bounties", icon: Coins },
  { href: "/watchers", label: "Watchers", icon: Eye },
  { href: "/endorse", label: "Endorse", icon: Handshake },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <header
      className={
        "sticky top-0 z-40 w-full transition-colors border-b " +
        (scrolled
          ? "bg-white/85 dark:bg-[#0B0D12]/85 backdrop-blur-md border-slate-200/70 dark:border-slate-800/60"
          : "bg-white dark:bg-[#0B0D12] border-transparent")
      }
    >
      <div className="mx-auto max-w-7xl flex h-16 items-center px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg group">
          <span className="relative">
            <Shield className="h-6 w-6 text-purple-600 transition-transform group-hover:scale-110" />
            <span className="absolute -inset-1 rounded-full bg-purple-600/20 blur-md opacity-0 group-hover:opacity-100 transition" />
          </span>
          <span>NDA Sentinel</span>
          <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-widest text-slate-400 border rounded px-1.5 py-0.5 border-slate-300 dark:border-slate-700">
            studionet
          </span>
        </Link>

        <nav className="ml-auto hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/")
            const Icon = item.icon
            const base =
              "text-sm font-medium px-3 py-1.5 rounded-md transition inline-flex items-center gap-1.5"
            const accent =
              item.accent === "rose"
                ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                : item.accent === "emerald"
                  ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60"
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${base} ${accent} ${active ? "ring-1 ring-inset ring-slate-300 dark:ring-slate-700" : ""}`}
              >
                {Icon ? <Icon className="w-4 h-4" /> : null}
                {item.label}
              </Link>
            )
          })}
          <InboxBell />
          <Link
            href="/ndas/new"
            className="ml-2 text-sm font-semibold px-3.5 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white transition inline-flex items-center gap-1.5"
          >
            Create NDA
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden ml-auto p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/60"
          aria-label="Toggle navigation"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open ? (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0D12]">
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/ndas/new"
              className="text-sm font-semibold px-3 py-2 rounded-md bg-purple-600 text-white text-center"
            >
              Create NDA
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  )
}
