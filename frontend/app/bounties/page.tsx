"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Coins, Plus, Clock, Users } from "lucide-react"
import {
  activeAddress,
  client,
  CONTRACT_ADDRESS,
  explorerAddressUrl,
  WALLET_CHANGED_EVENT,
} from "@/lib/genlayer"
import { formatGenAmount } from "@/lib/amount"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

interface OpenBountyRow {
  id: string
  title: string
  creator: string
  reward_pool: string
  deadline: string
  entries_count: string
}

interface UserBounties {
  created: number[]
  entered: number[]
}

export default function BountiesPage() {
  const [openList, setOpenList] = useState<OpenBountyRow[]>([])
  const [userLists, setUserLists] = useState<UserBounties | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [openRaw, mineRaw] = await Promise.all([
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_open_bounties",
          args: [],
        }) as Promise<string>,
        activeAddress
          ? (client.readContract({
              address: CONTRACT_ADDRESS,
              functionName: "get_user_bounties",
              args: [activeAddress],
            }) as Promise<string>)
          : Promise.resolve('{"created":[],"entered":[]}'),
      ])
      setOpenList(JSON.parse(openRaw))
      setUserLists(JSON.parse(mineRaw))
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Coins className="w-5 h-5" />
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              AI-adjudicated bounties
            </h1>
          </div>
          <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
            Post a public bounty with a rubric + reward pool. Anyone can
            submit an entry. After the deadline, GenLayer validators
            independently fetch every entry&apos;s proof page and reach
            consensus on the winner set — the contract distributes the
            reward atomically. No admin, no human curator.
          </p>
        </div>
        <Link href="/bounties/new">
          <Button className="bg-amber-600 hover:bg-amber-700">
            <Plus className="w-4 h-4 mr-1" /> New bounty
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open bounties</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : openList.length === 0
                ? "None right now."
                : `${openList.length} open, still accepting entries.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {openList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Reward</th>
                    <th className="py-2 pr-4">Entries</th>
                    <th className="py-2 pr-4">Deadline</th>
                    <th className="py-2 pr-4">Creator</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {openList.map((b) => {
                    const dl = new Date(Number(b.deadline) * 1000)
                    return (
                      <tr key={b.id} className="border-b last:border-none">
                        <td className="py-2 pr-4 font-mono">#{b.id}</td>
                        <td className="py-2 pr-4">
                          <div className="font-semibold truncate max-w-xs">
                            {b.title}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          {formatGenAmount(b.reward_pool)} GEN
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline">
                            <Users className="w-3 h-3 mr-1" /> {b.entries_count}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(dl, { addSuffix: true })}
                          </div>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          <a
                            href={explorerAddressUrl(b.creator)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {b.creator.slice(0, 8)}…{b.creator.slice(-4)}
                          </a>
                        </td>
                        <td className="py-2 pr-4">
                          <Link
                            href={`/bounties/${b.id}`}
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

      {userLists && (userLists.created.length > 0 || userLists.entered.length > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle>Your activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {userLists.created.length > 0 ? (
              <div>
                <div className="text-xs uppercase text-slate-500 mb-1">
                  Bounties you posted
                </div>
                <div className="flex flex-wrap gap-2">
                  {userLists.created.map((bid) => (
                    <Link
                      key={bid}
                      href={`/bounties/${bid}`}
                      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      #{bid}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {userLists.entered.length > 0 ? (
              <div>
                <div className="text-xs uppercase text-slate-500 mb-1">
                  Bounties you entered
                </div>
                <div className="flex flex-wrap gap-2">
                  {userLists.entered.map((bid) => (
                    <Link
                      key={bid}
                      href={`/bounties/${bid}`}
                      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      #{bid}
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
