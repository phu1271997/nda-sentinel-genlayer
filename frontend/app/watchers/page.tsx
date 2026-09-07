"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Eye, Plus, Clock, Zap } from "lucide-react"
import {
  activeAddress,
  client,
  CONTRACT_ADDRESS,
  WALLET_CHANGED_EVENT,
} from "@/lib/genlayer"
import { formatGenAmount } from "@/lib/amount"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

interface OpenWatcherRow {
  id: string
  label: string
  url: string
  match_rule: string
  reward_per_hit: string
  reward_pool: string
  cooldown_secs: string
  last_hit_at: string
  hits_count: string
  polls_count: string
  nda_link: string
}

interface UserWatchers {
  created: number[]
  polled: number[]
  poll_wins: string
}

export default function WatchersPage() {
  const [openList, setOpenList] = useState<OpenWatcherRow[]>([])
  const [user, setUser] = useState<UserWatchers | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [openRaw, uRaw] = await Promise.all([
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_open_watchers",
          args: [],
        }) as Promise<string>,
        activeAddress
          ? (client.readContract({
              address: CONTRACT_ADDRESS,
              functionName: "get_user_watchers",
              args: [activeAddress],
            }) as Promise<string>)
          : Promise.resolve('{"created":[],"polled":[],"poll_wins":"0"}'),
      ])
      setOpenList(JSON.parse(openRaw))
      setUser(JSON.parse(uRaw))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const h = () => load()
    window.addEventListener(WALLET_CHANGED_EVENT, h)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, h)
  }, [load])

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 py-10 space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <Eye className="w-5 h-5" />
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              AI Watchers
            </h1>
          </div>
          <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl text-sm">
            Subscribe the protocol to poll a public URL and consensus-
            evaluate its content against a plain-English rule. On a HIT
            the recipient&apos;s inbox fires, the poller earns the reward
            per hit from the watcher&apos;s pool. Cooldown windows
            prevent a single URL from firing repeatedly.
          </p>
        </div>
        <Link href="/watchers/new">
          <Button className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-1" /> New watcher
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active watchers</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : openList.length === 0
                ? "None right now."
                : `${openList.length} watcher${openList.length === 1 ? "" : "s"} accepting polls.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {openList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Label</th>
                    <th className="py-2 pr-4">Reward / hit</th>
                    <th className="py-2 pr-4">Pool</th>
                    <th className="py-2 pr-4">Hits</th>
                    <th className="py-2 pr-4">Last hit</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {openList.map((w) => {
                    const last = Number(w.last_hit_at)
                    return (
                      <tr key={w.id} className="border-b last:border-none">
                        <td className="py-2 pr-4 font-mono">#{w.id}</td>
                        <td className="py-2 pr-4">
                          <div className="font-semibold truncate max-w-xs">
                            {w.label}
                          </div>
                          <div className="text-xs text-slate-500 truncate max-w-xs">
                            {w.url}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            <Zap className="w-3 h-3 mr-1" />
                            {formatGenAmount(w.reward_per_hit)}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">
                          {formatGenAmount(w.reward_pool)} GEN
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline">
                            {w.hits_count} / {w.polls_count}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-500">
                          {last > 0
                            ? formatDistanceToNow(new Date(last * 1000), {
                                addSuffix: true,
                              })
                            : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <Link
                            href={`/watchers/${w.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {user && (user.created.length > 0 || user.polled.length > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle>Your activity</CardTitle>
            <CardDescription>
              You&apos;ve landed {user.poll_wins} successful poll
              {user.poll_wins === "1" ? "" : "s"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {user.created.length > 0 ? (
              <div>
                <div className="text-xs uppercase text-slate-500 mb-1">
                  Watchers you created
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.created.map((wid) => (
                    <Link
                      key={wid}
                      href={`/watchers/${wid}`}
                      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      #{wid}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {user.polled.length > 0 ? (
              <div>
                <div className="text-xs uppercase text-slate-500 mb-1">
                  Watchers you&apos;ve polled
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.polled.map((wid) => (
                    <Link
                      key={wid}
                      href={`/watchers/${wid}`}
                      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      #{wid}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
