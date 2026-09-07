"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Award, RefreshCcw, Users } from "lucide-react"
import {
  activeAddress,
  client,
  CONTRACT_ADDRESS,
  WALLET_CHANGED_EVENT,
} from "@/lib/genlayer"
import { BadgeGrid, type UserBadge } from "@/components/BadgeGrid"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge as UiBadge } from "@/components/ui/badge"

interface CatalogEntry {
  code: string
  max_tier: number
}

interface Scorecard {
  address: string
  reputation: { score: string; tier: string }
  badges: UserBadge[]
  counters: Record<string, string>
  publisher_handle: string
  encryption_key_registered: boolean
}

export default function BadgesPage() {
  const [address, setAddress] = useState<string>("")
  const [scorecard, setScorecard] = useState<Scorecard | null>(null)
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [holdersByCode, setHoldersByCode] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!activeAddress) return
    setLoading(true)
    try {
      setAddress(activeAddress)
      const [scoreRaw, catRaw] = await Promise.all([
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_user_scorecard",
          args: [activeAddress],
        }) as Promise<string>,
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_badge_catalog",
          args: [],
        }) as Promise<string>,
      ])
      const parsedScore = JSON.parse(scoreRaw) as Scorecard
      const parsedCat = JSON.parse(catRaw) as CatalogEntry[]
      setScorecard(parsedScore)
      setCatalog(parsedCat)
      const holderMap: Record<string, string[]> = {}
      await Promise.all(
        parsedCat.map(async (c) => {
          try {
            const raw = (await client.readContract({
              address: CONTRACT_ADDRESS,
              functionName: "get_badge_holders",
              args: [c.code],
            })) as string
            const list = JSON.parse(raw) as string[]
            holderMap[c.code] = Array.isArray(list) ? list : []
          } catch {
            holderMap[c.code] = []
          }
        }),
      )
      setHoldersByCode(holderMap)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const handler = () => load()
    window.addEventListener(WALLET_CHANGED_EVENT, handler)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, handler)
  }, [load])

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Award className="w-5 h-5" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Achievements
          </h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
          Soul-bound-style badges awarded by the contract as you use the
          protocol. Non-transferable, tiered, and derived deterministically
          from on-chain state — the contract writes them, no admin call.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your scorecard</CardTitle>
          <CardDescription>
            {address ? (
              <>
                <code className="text-xs">{address}</code>
              </>
            ) : (
              "Not connected"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scorecard ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-xs uppercase text-slate-500">
                    Reputation
                  </div>
                  <div className="mt-1 font-semibold">
                    {scorecard.reputation.score}{" "}
                    <UiBadge variant="outline">{scorecard.reputation.tier}</UiBadge>
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs uppercase text-slate-500">
                    Confirmed reports
                  </div>
                  <div className="mt-1 font-semibold">
                    {scorecard.counters.reports_confirmed} /{" "}
                    {scorecard.counters.reports_submitted}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs uppercase text-slate-500">
                    Appeal wins
                  </div>
                  <div className="mt-1 font-semibold">
                    {scorecard.counters.overturn_wins}
                  </div>
                </div>
              </div>

              <BadgeGrid badges={scorecard.badges} />
            </>
          ) : loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <p className="text-sm text-slate-500">No scorecard yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4" /> Badge catalog
              </CardTitle>
              <CardDescription>
                Total on-chain holders per badge code.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCcw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {catalog.map((c) => (
              <div key={c.code} className="rounded-md border p-3">
                <div className="text-sm font-mono">{c.code}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {holdersByCode[c.code]?.length ?? 0} holders · max tier{" "}
                  {c.max_tier}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-slate-500">
        Curious who&apos;s leading?{" "}
        <Link href="/leaderboard" className="underline">
          See the leaderboard →
        </Link>
      </div>
    </div>
  )
}
