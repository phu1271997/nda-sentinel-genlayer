"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Users, Plus } from "lucide-react"
import { activeAddress, client, CONTRACT_ADDRESS, WALLET_CHANGED_EVENT } from "@/lib/genlayer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge as UiBadge } from "@/components/ui/badge"
import { formatGenAmount } from "@/lib/amount"

interface GroupRow {
  id: string
  status: string
  scope: string
  parties_count: string
  activated_count: string
  threshold: string
  expiry_timestamp: string
  total_stake: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  leaked: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  expired: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
}

export default function GroupsPage() {
  const [rows, setRows] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!activeAddress) return
    setLoading(true)
    try {
      const raw = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_user_group_ndas",
        args: [activeAddress],
      })) as string
      setRows(JSON.parse(raw))
    } catch {
      setRows([])
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
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <Users className="w-5 h-5" />
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Group NDAs
            </h1>
          </div>
          <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
            3–10 party NDAs with threshold activation. Confirmed leaks
            slash the violator&apos;s stake and split compensation across
            non-violators proportionally.
          </p>
        </div>
        <Link href="/ndas/new-group">
          <Button className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-1" /> New group NDA
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your memberships</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : rows.length === 0
                ? "You have no group NDAs yet."
                : `${rows.length} group${rows.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Scope</th>
                    <th className="py-2 pr-4">Activation</th>
                    <th className="py-2 pr-4">Threshold</th>
                    <th className="py-2 pr-4">Total stake</th>
                    <th className="py-2 pr-4">Expiry</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-none">
                      <td className="py-2 pr-4 font-mono">#{r.id}</td>
                      <td className="py-2 pr-4">
                        <UiBadge className={STATUS_COLORS[r.status] ?? ""}>
                          {r.status}
                        </UiBadge>
                      </td>
                      <td className="py-2 pr-4 capitalize">
                        {r.scope.replaceAll("_", " ")}
                      </td>
                      <td className="py-2 pr-4">
                        {r.activated_count} / {r.parties_count}
                      </td>
                      <td className="py-2 pr-4">{r.threshold}</td>
                      <td className="py-2 pr-4">
                        {formatGenAmount(r.total_stake)} GEN
                      </td>
                      <td className="py-2 pr-4">
                        {new Date(
                          Number(r.expiry_timestamp) * 1000,
                        ).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/groups/${r.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
