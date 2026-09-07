"use client"

import { useCallback, useEffect, useState } from "react"
import { Trophy, RefreshCcw, ArrowUpRight } from "lucide-react"
import {
  assertWritable,
  client,
  CONTRACT_ADDRESS,
  ensureCorrectChainBeforeWrite,
  explorerAddressUrl,
  explorerTxUrl,
  WalletNotReadyError,
} from "@/lib/genlayer"
import { parseContractError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge as UiBadge } from "@/components/ui/badge"

interface LeaderboardRow {
  address: string
  reputation: number
  badge_count: number
  badge_score: number
  reports_confirmed: number
  overturn_wins: number
}

interface LeaderboardResponse {
  snapshot_at: string
  rows: LeaderboardRow[]
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_leaderboard",
        args: [],
      })) as string
      const parsed = JSON.parse(raw) as LeaderboardResponse
      setData(parsed)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rebuild = async () => {
    setError(null)
    setTxHash(null)
    setRefreshing(true)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "rebuild_leaderboard",
        args: [BigInt(25)],
        value: BigInt(0),
      })
      setTxHash(hash)
      await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED" as never,
        retries: 60,
        interval: 3000,
      })
      await load()
    } catch (err) {
      if (err instanceof WalletNotReadyError) {
        setError(err.message)
      } else {
        setError(parseContractError(err))
      }
    } finally {
      setRefreshing(false)
    }
  }

  const snapshotDate =
    data && Number(data.snapshot_at) > 0
      ? new Date(Number(data.snapshot_at) * 1000).toLocaleString()
      : "never"

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Trophy className="w-5 h-5" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Leaderboard
          </h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
          Snapshot of the top participants by (badge score, reputation,
          confirmed reports). Anyone can trigger a rebuild — the write
          walks the badge-holder indexes and re-sorts client-side, so
          gas stays bounded.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Top participants</CardTitle>
              <CardDescription>Snapshot: {snapshotDate}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={rebuild}
              disabled={refreshing}
            >
              <RefreshCcw
                className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`}
              />
              Rebuild
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : data && data.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Address</th>
                    <th className="py-2 pr-4">Badge score</th>
                    <th className="py-2 pr-4">Badges</th>
                    <th className="py-2 pr-4">Reputation</th>
                    <th className="py-2 pr-4">Confirmed reports</th>
                    <th className="py-2 pr-4">Appeal wins</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={r.address} className="border-b last:border-none">
                      <td className="py-2 pr-4 font-semibold">
                        <UiBadge
                          variant={i < 3 ? "default" : "outline"}
                          className={
                            i === 0
                              ? "bg-yellow-500/20 text-yellow-800 dark:text-yellow-300"
                              : i === 1
                                ? "bg-slate-400/20 text-slate-800 dark:text-slate-200"
                                : i === 2
                                  ? "bg-amber-700/20 text-amber-800 dark:text-amber-300"
                                  : undefined
                          }
                        >
                          #{i + 1}
                        </UiBadge>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        <a
                          className="hover:underline flex items-center gap-1"
                          href={explorerAddressUrl(r.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {r.address.slice(0, 8)}…{r.address.slice(-6)}
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-2 pr-4">{r.badge_score}</td>
                      <td className="py-2 pr-4">{r.badge_count}</td>
                      <td className="py-2 pr-4">{r.reputation}</td>
                      <td className="py-2 pr-4">{r.reports_confirmed}</td>
                      <td className="py-2 pr-4">{r.overturn_wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No snapshot yet. Click <strong>Rebuild</strong> to generate one.
            </p>
          )}
          {txHash ? (
            <p className="text-xs text-slate-500 mt-3">
              Tx:{" "}
              <a
                className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                href={explorerTxUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {txHash.slice(0, 10)}…{txHash.slice(-8)}
              </a>
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-3">{error}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
