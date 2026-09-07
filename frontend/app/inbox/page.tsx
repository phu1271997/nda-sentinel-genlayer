"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Bell,
  BellOff,
  Check,
  Circle,
  ExternalLink,
  Inbox,
  Settings2,
  Trash2,
} from "lucide-react"
import {
  activeAddress,
  assertWritable,
  client,
  CONTRACT_ADDRESS,
  ensureCorrectChainBeforeWrite,
  explorerTxUrl,
  WALLET_CHANGED_EVENT,
  WalletNotReadyError,
} from "@/lib/genlayer"
import { parseContractError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge as UiBadge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"

interface InboxEntry {
  seq: number
  kind: string
  nda_id: number
  title: string
  body: string
  created_at: number
  read: boolean
}

interface InboxPage {
  total: number
  from: number
  to: number
  items: InboxEntry[]
}

const NON_NDA_KINDS = new Set(["badge_awarded"])

export default function InboxPage() {
  const [page, setPage] = useState<InboxPage | null>(null)
  const [unread, setUnread] = useState<number>(0)
  const [kinds, setKinds] = useState<string[]>([])
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [browserOptIn, setBrowserOptIn] = useState<
    "unsupported" | "default" | "granted" | "denied"
  >("default")

  const load = useCallback(async () => {
    if (!activeAddress) return
    try {
      const [pageRaw, unreadRaw, kindsRaw, prefsRaw] = await Promise.all([
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_inbox_page",
          args: [activeAddress, BigInt(0), BigInt(50)],
        }) as Promise<string>,
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_inbox_unread_count",
          args: [activeAddress],
        }) as Promise<bigint>,
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_notify_kinds",
          args: [],
        }) as Promise<string>,
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_notify_prefs",
          args: [activeAddress],
        }) as Promise<string>,
      ])
      setPage(JSON.parse(pageRaw))
      setUnread(Number(unreadRaw ?? 0))
      setKinds(JSON.parse(kindsRaw))
      const rawPrefs = JSON.parse(prefsRaw)
      const asDict = typeof rawPrefs === "object" && rawPrefs !== null ? rawPrefs : {}
      setPrefs(asDict)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    load()
    const handler = () => load()
    window.addEventListener(WALLET_CHANGED_EVENT, handler)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, handler)
  }, [load])

  useEffect(() => {
    if (typeof Notification === "undefined") setBrowserOptIn("unsupported")
    else setBrowserOptIn(Notification.permission as typeof browserOptIn)
  }, [])

  const highestSeq = useMemo(() => {
    if (!page || page.items.length === 0) return 0
    return Math.max(...page.items.map((i) => i.seq))
  }, [page])

  const markAllRead = async () => {
    setError(null)
    setBusy(true)
    setTxHash(null)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "mark_all_inbox_read",
        args: [],
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
      if (err instanceof WalletNotReadyError) setError(err.message)
      else setError(parseContractError(err))
    } finally {
      setBusy(false)
    }
  }

  const clearRead = async () => {
    setError(null)
    setBusy(true)
    setTxHash(null)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "clear_read_inbox",
        args: [],
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
      if (err instanceof WalletNotReadyError) setError(err.message)
      else setError(parseContractError(err))
    } finally {
      setBusy(false)
    }
  }

  const savePrefs = async () => {
    setError(null)
    setBusy(true)
    setTxHash(null)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "set_notify_prefs",
        args: [JSON.stringify(prefs)],
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
      if (err instanceof WalletNotReadyError) setError(err.message)
      else setError(parseContractError(err))
    } finally {
      setBusy(false)
    }
  }

  const requestBrowserPermission = async () => {
    if (typeof Notification === "undefined") return
    const result = await Notification.requestPermission()
    setBrowserOptIn(result as typeof browserOptIn)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <Inbox className="w-5 h-5" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Notifications
          </h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
          On-chain inbox that captures every lifecycle event touching your
          address. Preferences let you opt out of specific kinds. Browser
          desktop notifications are optional and stay on this device.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-4 h-4" /> Recent
              </CardTitle>
              <CardDescription>
                {unread > 0 ? (
                  <>
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      {unread} unread
                    </span>{" "}
                    of {page?.total ?? 0} total
                  </>
                ) : (
                  <>{page?.total ?? 0} total</>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={markAllRead} disabled={busy || unread === 0}>
                <Check className="w-4 h-4 mr-1" /> Mark all read
              </Button>
              <Button variant="outline" size="sm" onClick={clearRead} disabled={busy}>
                <Trash2 className="w-4 h-4 mr-1" /> Clear read
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {page && page.items.length > 0 ? (
            <ul className="space-y-3">
              {page.items.map((it) => (
                <li
                  key={it.seq}
                  className={
                    "rounded-md border p-3 flex gap-3 items-start " +
                    (!it.read
                      ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
                      : "bg-white dark:bg-slate-900")
                  }
                >
                  <Circle
                    className={
                      "w-3 h-3 mt-1 shrink-0 " +
                      (it.read
                        ? "text-slate-300"
                        : "text-rose-500 fill-rose-500")
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <UiBadge variant="outline" className="text-[10px]">
                        {it.kind}
                      </UiBadge>
                      {it.nda_id > 0 && !NON_NDA_KINDS.has(it.kind) ? (
                        <Link
                          href={`/ndas/${it.nda_id}`}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          NDA #{it.nda_id} <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : null}
                      <span className="text-[10px] text-slate-500 ml-auto">
                        {formatDistanceToNow(new Date(it.created_at * 1000), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div className="text-sm font-semibold mt-0.5">{it.title}</div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {it.body}
                    </p>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {format(new Date(it.created_at * 1000), "PPPp")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 italic">Inbox empty.</p>
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
              {highestSeq ? ` · latest seq ${highestSeq}` : null}
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-3">{error}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Preferences
          </CardTitle>
          <CardDescription>
            Opt out of specific notification kinds. Silenced kinds are dropped
            at the contract level — nothing is ever queued.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {kinds.map((k) => {
              const enabled = prefs[k] !== false
              return (
                <label
                  key={k}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) =>
                      setPrefs((prev) => ({ ...prev, [k]: e.target.checked }))
                    }
                  />
                  <span className="font-mono">{k}</span>
                  {!enabled ? (
                    <BellOff className="w-3 h-3 text-slate-400 ml-auto" />
                  ) : (
                    <Bell className="w-3 h-3 text-emerald-500 ml-auto" />
                  )}
                </label>
              )
            })}
          </div>
          <Button onClick={savePrefs} disabled={busy}>
            Save preferences
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Browser desktop notifications</CardTitle>
          <CardDescription>
            Optional add-on. Uses the browser Notifications API — stays on this
            device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          {browserOptIn === "unsupported" ? (
            <p className="text-sm text-slate-500">
              Browser notifications are not supported here.
            </p>
          ) : browserOptIn === "granted" ? (
            <UiBadge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              Enabled
            </UiBadge>
          ) : browserOptIn === "denied" ? (
            <p className="text-sm text-rose-600">
              Blocked in your browser settings.
            </p>
          ) : (
            <Button variant="outline" size="sm" onClick={requestBrowserPermission}>
              Enable
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
