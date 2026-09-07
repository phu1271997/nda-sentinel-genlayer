"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Coins,
  Users,
  Gavel,
  PlusCircle,
  ShieldAlert,
  ArrowUpRight,
  X,
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge as UiBadge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"

interface Bounty {
  id: bigint
  creator: string
  title: string
  description: string
  rubric: string
  reward_pool: bigint
  protocol_fee_accrued: bigint
  deadline: bigint
  status: string
  created_at: bigint
  adjudicated_at: bigint
  entries_count: bigint
  winners_json: string
  adjudicator: string
}

interface Entry {
  index: number
  participant: string
  proof_url: string
  notes: string
  submitted_at: number
}

interface Winner {
  entry_index: number
  participant: string
  share_bps: number
  score: number
  rationale: string
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paid: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  cancelled: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  no_valid_entries: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
}

export default function BountyDetailPage() {
  const { bountyId } = useParams()
  const [bounty, setBounty] = useState<Bounty | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [proofUrl, setProofUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [sponsorAmount, setSponsorAmount] = useState("0.1")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [bRaw, eRaw] = await Promise.all([
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_bounty",
          args: [BigInt(bountyId as string)],
        }) as Promise<unknown>,
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_bounty_entries",
          args: [BigInt(bountyId as string)],
        }) as Promise<unknown>,
      ])
      setBounty(bRaw as Bounty)
      setEntries(JSON.parse(eRaw as string))
    } catch (err) {
      setError((err as Error).message)
    }
  }, [bountyId])

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

  const submitEntry = () =>
    runWrite(() => {
      if (!proofUrl) throw new Error("Proof URL required.")
      return client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "submit_bounty_entry",
        args: [BigInt(bountyId as string), proofUrl, notes],
        value: BigInt(0),
      })
    })

  const sponsor = () =>
    runWrite(() =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "sponsor_bounty",
        args: [BigInt(bountyId as string)],
        value: parseGenAmount(sponsorAmount),
      }),
    )

  const cancel = () =>
    runWrite(() =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "cancel_bounty",
        args: [BigInt(bountyId as string)],
        value: BigInt(0),
      }),
    )

  const adjudicate = () =>
    runWrite(() =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "adjudicate_bounty",
        args: [BigInt(bountyId as string)],
        value: BigInt(0),
      }),
    )

  if (!bounty) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-10">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  const me = activeAddress?.toLowerCase() ?? ""
  const isCreator = me === bounty.creator.toLowerCase()
  const alreadyEntered = entries.some((e) => e.participant.toLowerCase() === me)
  const deadlineDate = new Date(Number(bounty.deadline) * 1000)
  const past = deadlineDate.getTime() < Date.now()
  const isOpen = bounty.status === "open"
  const winners: Winner[] = (() => {
    try {
      return JSON.parse(bounty.winners_json) as Winner[]
    } catch {
      return []
    }
  })()

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Coins className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        <h1 className="text-2xl font-bold">
          Bounty #{bounty.id.toString()}
        </h1>
        <UiBadge className={STATUS_STYLES[bounty.status] ?? ""}>
          {bounty.status}
        </UiBadge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{bounty.title}</CardTitle>
          <CardDescription>
            Posted by{" "}
            <a
              className="hover:underline font-mono"
              href={explorerAddressUrl(bounty.creator)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {bounty.creator.slice(0, 8)}…{bounty.creator.slice(-6)}
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase text-slate-500">Reward pool</div>
              <div className="font-semibold text-lg">
                {formatGenAmount(bounty.reward_pool.toString())} GEN
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Entries</div>
              <div className="font-semibold text-lg">
                <Users className="w-4 h-4 inline mr-1" />
                {bounty.entries_count.toString()}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Deadline</div>
              <div className="font-semibold">
                {past ? "passed " : ""}
                {formatDistanceToNow(deadlineDate, { addSuffix: true })}
              </div>
              <div className="text-xs text-slate-500">
                {format(deadlineDate, "PPPp")}
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500 mb-1">Description</div>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {bounty.description}
            </p>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500 mb-1">Adjudication rubric</div>
            <pre className="text-xs bg-slate-100 dark:bg-slate-900 rounded p-3 whitespace-pre-wrap">
              {bounty.rubric}
            </pre>
          </div>
        </CardContent>
      </Card>

      {isOpen && !past && !isCreator ? (
        <Card>
          <CardHeader>
            <CardTitle>Submit an entry</CardTitle>
            <CardDescription>
              Publish your work at a public URL and paste it below. The AI
              Jury will fetch and score it after the deadline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alreadyEntered ? (
              <div className="text-sm rounded-md bg-slate-100 dark:bg-slate-900 p-3">
                You already have an entry on this bounty.
              </div>
            ) : (
              <>
                <Input
                  placeholder="https://…"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                />
                <Textarea
                  rows={3}
                  placeholder="Short notes (advisory, ≤ 500 chars)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <Button onClick={submitEntry} disabled={busy} className="bg-amber-600 hover:bg-amber-700">
                  Submit entry
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isOpen && !past ? (
        <Card>
          <CardHeader>
            <CardTitle>Sponsor this bounty</CardTitle>
            <CardDescription>Add to the reward pool.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Input
              type="number"
              step="0.1"
              value={sponsorAmount}
              onChange={(e) => setSponsorAmount(e.target.value)}
              className="w-40"
            />
            <span className="text-sm">GEN</span>
            <Button variant="outline" onClick={sponsor} disabled={busy}>
              <PlusCircle className="w-4 h-4 mr-1" /> Top up
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isCreator && isOpen && Number(bounty.entries_count) === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Creator controls</CardTitle>
            <CardDescription>
              You can cancel and refund the pool while no entries are in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="text-rose-600" onClick={cancel} disabled={busy}>
              <X className="w-4 h-4 mr-1" /> Cancel + refund
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isOpen && past ? (
        <Card className="border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="w-4 h-4" /> Adjudicate
            </CardTitle>
            <CardDescription>
              Deadline passed. Anyone can trigger consensus adjudication;
              you earn the <code>adjudicator</code> badge on success.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={adjudicate} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
              {busy ? "Running consensus…" : "Run AI Jury adjudication"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {winners.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Winners</CardTitle>
            <CardDescription>
              Chosen by GenLayer AI Jury via <code>eq_principle</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Entry</th>
                    <th className="py-2 pr-4">Participant</th>
                    <th className="py-2 pr-4">Score</th>
                    <th className="py-2 pr-4">Share (bps)</th>
                    <th className="py-2 pr-4">Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {winners.map((w, i) => (
                    <tr key={i} className="border-b last:border-none">
                      <td className="py-2 pr-4">
                        <UiBadge>#{i + 1}</UiBadge>
                      </td>
                      <td className="py-2 pr-4 font-mono">#{w.entry_index}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        <a
                          href={explorerAddressUrl(w.participant)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {w.participant.slice(0, 8)}…{w.participant.slice(-6)}
                        </a>
                      </td>
                      <td className="py-2 pr-4">{w.score}</td>
                      <td className="py-2 pr-4">{w.share_bps}</td>
                      <td className="py-2 pr-4 text-xs italic">{w.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Entries ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No entries yet.</p>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.index} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <UiBadge variant="outline">#{e.index}</UiBadge>
                    <a
                      className="font-mono text-xs hover:underline"
                      href={explorerAddressUrl(e.participant)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {e.participant.slice(0, 8)}…{e.participant.slice(-6)}
                    </a>
                    <span className="text-xs text-slate-500 ml-auto">
                      {formatDistanceToNow(new Date(e.submitted_at * 1000), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <a
                    href={e.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 text-xs break-all"
                  >
                    {e.proof_url} <ArrowUpRight className="w-3 h-3" />
                  </a>
                  {e.notes ? (
                    <p className="text-xs text-slate-500 mt-1">{e.notes}</p>
                  ) : null}
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
        <Link href="/bounties" className="underline">
          ← All bounties
        </Link>
      </div>
    </div>
  )
}
