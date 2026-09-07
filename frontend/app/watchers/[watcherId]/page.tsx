"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Eye,
  Zap,
  Clock,
  Play,
  Pause,
  X,
  PlusCircle,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import {
  activeAddress,
  assertWritable,
  client,
  CONTRACT_ADDRESS,
  ensureCorrectChainBeforeWrite,
  explorerAddressUrl,
  explorerTxUrl,
  WALLET_CHANGED_EVENT,
  WalletNotReadyError,
} from "@/lib/genlayer"
import { parseGenAmount, formatGenAmount } from "@/lib/amount"
import { parseContractError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge as UiBadge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"

interface Watcher {
  id: bigint
  creator: string
  label: string
  url_to_watch: string
  match_rule: string
  notify_recipient: string
  nda_link: bigint
  cooldown_secs: bigint
  reward_per_hit: bigint
  reward_pool: bigint
  total_paid_out: bigint
  hits_count: bigint
  polls_count: bigint
  last_polled_at: bigint
  last_hit_at: bigint
  status: string
  created_at: bigint
}

interface Hit {
  at: number
  poller: string
  confidence: number
  evidence: string
  reason: string
  paid_wei: number
  suppressed_by_cooldown: boolean
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  drained: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  cancelled: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
}

export default function WatcherDetailPage() {
  const { watcherId } = useParams()
  const [w, setW] = useState<Watcher | null>(null)
  const [hits, setHits] = useState<Hit[]>([])
  const [topUp, setTopUp] = useState("0.1")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [wRaw, hRaw] = await Promise.all([
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_watcher",
          args: [BigInt(watcherId as string)],
        }) as Promise<unknown>,
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_watcher_hits",
          args: [BigInt(watcherId as string)],
        }) as Promise<unknown>,
      ])
      setW(wRaw as Watcher)
      const parsed = JSON.parse(hRaw as string) as Hit[]
      setHits(Array.isArray(parsed) ? parsed : [])
    } catch (err) {
      setError((err as Error).message)
    }
  }, [watcherId])

  useEffect(() => {
    load()
    const h = () => load()
    window.addEventListener(WALLET_CHANGED_EVENT, h)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, h)
  }, [load])

  const runWrite = async (fn: () => Promise<unknown>) => {
    setError(null)
    setTxHash(null)
    setBusy(true)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = (await fn()) as `0x${string}`
      setTxHash(hash)
      await client.waitForTransactionReceipt({
        hash: hash as unknown as `0x${string}` & { length: 66 },
        status: "ACCEPTED" as never,
        retries: 120,
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

  const poll = () =>
    runWrite(() =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "poll_watcher",
        args: [BigInt(watcherId as string)],
        value: BigInt(0),
      }),
    )

  const topUpWatcher = () =>
    runWrite(() =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "top_up_watcher",
        args: [BigInt(watcherId as string)],
        value: parseGenAmount(topUp),
      }),
    )

  const pause = () =>
    runWrite(() =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "pause_watcher",
        args: [BigInt(watcherId as string)],
        value: BigInt(0),
      }),
    )

  const resume = () =>
    runWrite(() =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "resume_watcher",
        args: [BigInt(watcherId as string)],
        value: BigInt(0),
      }),
    )

  const cancel = () =>
    runWrite(() =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "cancel_watcher",
        args: [BigInt(watcherId as string)],
        value: BigInt(0),
      }),
    )

  if (!w) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-10">
        <p className="text-sm text-slate-500">Loading watcher…</p>
      </div>
    )
  }

  const me = (activeAddress ?? "").toLowerCase()
  const isCreator = me === w.creator.toLowerCase()
  const lastHit = Number(w.last_hit_at)
  const now = Math.floor(Date.now() / 1000)
  const cooldownRemaining = lastHit > 0
    ? Math.max(0, lastHit + Number(w.cooldown_secs) - now)
    : 0

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Eye className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        <h1 className="text-2xl font-bold">Watcher #{w.id.toString()}</h1>
        <UiBadge className={STATUS_STYLES[w.status]}>{w.status}</UiBadge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="truncate">{w.label}</CardTitle>
          <CardDescription>
            Posted by{" "}
            <a
              href={explorerAddressUrl(w.creator)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:underline"
            >
              {w.creator.slice(0, 8)}…{w.creator.slice(-6)}
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <div className="text-xs uppercase text-slate-500">Reward pool</div>
              <div className="font-semibold text-lg">
                {formatGenAmount(w.reward_pool.toString())} GEN
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Reward/hit</div>
              <div className="font-semibold text-lg flex items-center gap-1">
                <Zap className="w-4 h-4" />
                {formatGenAmount(w.reward_per_hit.toString())}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Hits / polls</div>
              <div className="font-semibold text-lg">
                {w.hits_count.toString()} / {w.polls_count.toString()}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Cooldown</div>
              <div className="font-semibold">
                {(Number(w.cooldown_secs) / 60).toFixed(0)} min
                {cooldownRemaining > 0 ? (
                  <span className="block text-xs text-amber-600">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {Math.ceil(cooldownRemaining / 60)} min left
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500 mb-1">Watched URL</div>
            <a
              href={w.url_to_watch}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline break-all inline-flex items-center gap-1"
            >
              {w.url_to_watch} <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500 mb-1">Match rule</div>
            <pre className="text-xs bg-slate-100 dark:bg-slate-900 rounded p-3 whitespace-pre-wrap">
              {w.match_rule}
            </pre>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div>
              <div className="uppercase text-slate-500">Recipient</div>
              <a
                href={explorerAddressUrl(w.notify_recipient)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline font-mono"
              >
                {w.notify_recipient.slice(0, 10)}…{w.notify_recipient.slice(-8)}
              </a>
            </div>
            {Number(w.nda_link) > 0 ? (
              <div>
                <div className="uppercase text-slate-500">Linked NDA</div>
                <Link
                  href={`/ndas/${w.nda_link}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  NDA #{w.nda_link.toString()}
                </Link>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {w.status === "active" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Poll now
            </CardTitle>
            <CardDescription>
              Anyone can poll. Validators fetch the URL and consensus-
              evaluate against the rule. On a HIT: recipient is inboxed
              and you earn {formatGenAmount(w.reward_per_hit.toString())} GEN.
              On a NO_HIT you earn a small stipend from the pool.
              {cooldownRemaining > 0 ? (
                <span className="text-amber-600 block mt-1">
                  Cooldown active — a HIT during cooldown pays only the
                  stipend.
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={poll}
              disabled={busy}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {busy ? "Running consensus…" : "Poll watcher"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isCreator && w.status !== "cancelled" ? (
        <Card>
          <CardHeader>
            <CardTitle>Creator controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="number"
                step="0.1"
                value={topUp}
                onChange={(e) => setTopUp(e.target.value)}
                className="w-32"
              />
              <span className="text-sm">GEN</span>
              <Button variant="outline" onClick={topUpWatcher} disabled={busy}>
                <PlusCircle className="w-4 h-4 mr-1" /> Top up
              </Button>
              {w.status === "active" ? (
                <Button variant="outline" onClick={pause} disabled={busy}>
                  <Pause className="w-4 h-4 mr-1" /> Pause
                </Button>
              ) : w.status === "paused" ? (
                <Button variant="outline" onClick={resume} disabled={busy}>
                  <Play className="w-4 h-4 mr-1" /> Resume
                </Button>
              ) : null}
              <Button variant="outline" className="text-rose-600" onClick={cancel} disabled={busy}>
                <X className="w-4 h-4 mr-1" /> Cancel + refund
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Hit history</CardTitle>
          <CardDescription>
            Last {hits.length} entries. Includes suppressed hits (during
            cooldown) as informational entries — no reward, just log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hits.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              No hits yet. Poll to check.
            </p>
          ) : (
            <ul className="space-y-3">
              {hits
                .slice()
                .reverse()
                .map((h, i) => (
                  <li key={i} className="border rounded-md p-3">
                    <div className="flex items-center gap-2 mb-1">
                      {h.suppressed_by_cooldown ? (
                        <UiBadge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          suppressed
                        </UiBadge>
                      ) : (
                        <UiBadge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          HIT · {formatGenAmount(String(h.paid_wei))} GEN
                        </UiBadge>
                      )}
                      <span className="text-xs text-slate-500">
                        confidence {h.confidence}
                      </span>
                      <span className="text-xs text-slate-500 ml-auto">
                        {format(new Date(h.at * 1000), "PPPp")}
                      </span>
                    </div>
                    {h.evidence ? (
                      <blockquote className="text-xs italic border-l-2 border-purple-400 pl-2 my-2 text-slate-700 dark:text-slate-300">
                        &ldquo;{h.evidence}&rdquo;
                      </blockquote>
                    ) : null}
                    <div className="text-xs text-slate-500">{h.reason}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-1">
                      poller: {h.poller.slice(0, 10)}…{h.poller.slice(-8)}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {error ? (
        <div className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 rounded-md p-3 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5" /> {error}
        </div>
      ) : null}
      {txHash ? (
        <p className="text-xs text-slate-500">
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
      <div className="text-xs text-slate-500">
        <Link href="/watchers" className="underline">
          ← All watchers
        </Link>
      </div>
    </div>
  )
}
