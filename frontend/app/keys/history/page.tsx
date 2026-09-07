"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Sparkles, ArrowUpRight } from "lucide-react"
import { activeAddress, client, CONTRACT_ADDRESS, WALLET_CHANGED_EVENT } from "@/lib/genlayer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

interface Entry {
  kind: string
  at: number
  meta: Record<string, unknown>
}

const STYLE: Record<string, string> = {
  registered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rotated: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  revoked: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  self_declared: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  guardians_set: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  recovery_initiated: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  guardian_approved: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  recovery_finalized: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
}

export default function KeyHistoryPage() {
  const [entries, setEntries] = useState<Entry[]>([])

  const load = useCallback(async () => {
    if (!activeAddress) return
    try {
      const raw = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_key_history",
        args: [activeAddress],
      })) as string
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) setEntries(parsed as Entry[])
    } catch {
      setEntries([])
    }
  }, [])

  useEffect(() => {
    load()
    const handler = () => load()
    window.addEventListener(WALLET_CHANGED_EVENT, handler)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, handler)
  }, [load])

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Sparkles className="w-5 h-5" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Key transparency log
          </h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
          Append-only audit trail of every encryption-key state change on
          your address — registration, rotation, revocation, guardian
          approvals, recovery finalization. Certificate-Transparency-style
          proof for anyone auditing whether the pubkey they are about to
          encrypt for is actually the latest one.
        </p>
        <Link href="/keys" className="text-xs text-emerald-700 dark:text-emerald-300 underline">
          ← back to keys
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardDescription>
            Newest first. {entries.length} total.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              No entries. Register a key at{" "}
              <Link href="/keys" className="underline">
                /keys
              </Link>{" "}
              to start the log.
            </p>
          ) : (
            <ul className="space-y-3">
              {entries
                .slice()
                .reverse()
                .map((e, i) => {
                  const url =
                    (e.meta && (e.meta.proof_url as string)) ||
                    (e.meta && (e.meta.reason_url as string)) ||
                    (e.meta && (e.meta.url as string)) ||
                    ""
                  return (
                    <li key={i} className="rounded-md border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={STYLE[e.kind] ?? ""}>{e.kind}</Badge>
                        <span className="text-xs text-slate-500">
                          {format(new Date(e.at * 1000), "PPPp")}
                        </span>
                      </div>
                      <pre className="text-xs bg-slate-100 dark:bg-slate-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(e.meta, null, 2)}
                      </pre>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 mt-2"
                        >
                          proof URL <ArrowUpRight className="w-3 h-3" />
                        </a>
                      ) : null}
                    </li>
                  )
                })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
