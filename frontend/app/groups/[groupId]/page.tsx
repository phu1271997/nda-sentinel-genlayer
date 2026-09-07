"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
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
import { hashKeyword } from "@/lib/crypto"
import { parseContractError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge as UiBadge } from "@/components/ui/badge"
import { Users, ShieldAlert, ArrowUpRight, Flame, Clock } from "lucide-react"
import { format } from "date-fns"

interface GroupNDA {
  id: bigint
  creator: string
  scope: string
  context_description: string
  expiry_timestamp: bigint
  threshold: bigint
  parties_count: bigint
  activated_count: bigint
  status: "pending" | "active" | "leaked" | "expired"
  created_at: bigint
  activated_at: bigint
  keyword_hash_count: bigint
  total_stake: bigint
  slashed_amount: bigint
  violator: string
  reporter: string
  suspect_url: string
  verdict_json: string
}

interface MembershipRow {
  address: string
  stake: string
  activated: boolean
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  leaked: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  expired: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
}

export default function GroupNDADetailPage() {
  const { groupId } = useParams()
  const [group, setGroup] = useState<GroupNDA | null>(null)
  const [members, setMembers] = useState<MembershipRow[]>([])
  const [joinStake, setJoinStake] = useState("100")
  const [reportUrl, setReportUrl] = useState("")
  const [reportKeywords, setReportKeywords] = useState("")
  const [salt, setSalt] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [gRaw, mRaw] = await Promise.all([
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_group_nda",
          args: [BigInt(groupId as string)],
        }) as Promise<unknown>,
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_group_membership",
          args: [BigInt(groupId as string)],
        }) as Promise<unknown>,
      ])
      setGroup(gRaw as GroupNDA)
      setMembers(JSON.parse(mRaw as string))
    } catch (err) {
      setError((err as Error).message)
    }
  }, [groupId])

  useEffect(() => {
    load()
    const handler = () => load()
    window.addEventListener(WALLET_CHANGED_EVENT, handler)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, handler)
  }, [load])

  const me = (activeAddress ?? "").toLowerCase()
  const iAmMember = members.some((m) => m.address === me)
  const iAmActivated = members.find((m) => m.address === me)?.activated ?? false

  const runWrite = async (fn: () => Promise<unknown>) => {
    setError(null)
    setTxHash(null)
    setBusy(true)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = (await fn()) as `0x${string}`
      setTxHash(hash)
      // client.waitForTransactionReceipt expects a runtime Hash brand;
      // the returned value is a real 66-char hex string at runtime.
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

  const joinGroup = () =>
    runWrite(() =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "join_group_nda",
        args: [BigInt(groupId as string)],
        value: parseGenAmount(joinStake),
      }),
    )

  const expireGroup = () =>
    runWrite(() =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "expire_group_nda",
        args: [BigInt(groupId as string)],
        value: BigInt(0),
      }),
    )

  const reportLeak = () =>
    runWrite(() => {
      const keywords = reportKeywords
        .split("\n")
        .map((k) => k.trim())
        .filter(Boolean)
      if (keywords.length === 0) throw new Error("Reveal at least one keyword.")
      if (!salt) throw new Error("Salt required (from your vault file).")
      return client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "report_group_leak",
        args: [
          BigInt(groupId as string),
          reportUrl,
          JSON.stringify(keywords),
          salt,
        ],
        value: parseGenAmount("1"),
      })
    })

  if (!group) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-10">
        <p className="text-sm text-slate-500">Loading group NDA…</p>
      </div>
    )
  }

  const expired = Number(group.expiry_timestamp) * 1000 < Date.now()

  const parsedVerdict = (() => {
    try {
      return group.verdict_json ? JSON.parse(group.verdict_json) : null
    } catch {
      return null
    }
  })()

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        <h1 className="text-2xl font-bold">
          Group NDA #{group.id.toString()}
        </h1>
        <UiBadge className={STATUS_COLORS[group.status]}>{group.status}</UiBadge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase text-slate-500">Scope</div>
              <div className="capitalize font-medium">
                {group.scope.replaceAll("_", " ")}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Expiry</div>
              <div className="font-medium">
                {format(new Date(Number(group.expiry_timestamp) * 1000), "PPP")}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Activation</div>
              <div className="font-medium">
                {group.activated_count.toString()} / {group.parties_count.toString()}{" "}
                (threshold {group.threshold.toString()})
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Total stake</div>
              <div className="font-medium">
                {formatGenAmount(group.total_stake.toString())} GEN
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">
              Public context
            </div>
            <p className="mt-1">{group.context_description}</p>
          </div>
          <div className="text-xs text-slate-500">
            Keyword hashes on-chain: {group.keyword_hash_count.toString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Every party&apos;s stake share drives their compensation payout on
            a confirmed violation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b">
                  <th className="py-2 pr-4">Address</th>
                  <th className="py-2 pr-4">Stake</th>
                  <th className="py-2 pr-4">Activated</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.address} className="border-b last:border-none">
                    <td className="py-2 pr-4 font-mono text-xs">
                      <a
                        className="hover:underline flex items-center gap-1"
                        href={explorerAddressUrl(m.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {m.address.slice(0, 8)}…{m.address.slice(-6)}
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                      {m.address === me ? (
                        <span className="text-[10px] text-emerald-600 ml-1">
                          (you)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">
                      {formatGenAmount(m.stake)} GEN
                    </td>
                    <td className="py-2 pr-4">
                      {m.activated ? (
                        <UiBadge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          yes
                        </UiBadge>
                      ) : (
                        <UiBadge variant="outline">no</UiBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {iAmMember && !iAmActivated && group.status === "pending" ? (
        <Card>
          <CardHeader>
            <CardTitle>Join this group NDA</CardTitle>
            <CardDescription>
              Stake to activate. Once {group.threshold.toString()} of{" "}
              {group.parties_count.toString()} parties have activated, the
              NDA goes live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="number"
              step="0.1"
              value={joinStake}
              onChange={(e) => setJoinStake(e.target.value)}
              placeholder="Stake in GEN"
            />
            <Button
              onClick={joinGroup}
              disabled={busy}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {busy ? "Awaiting consensus…" : "Stake & join"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {iAmMember && group.status === "active" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500" /> Report a leak
            </CardTitle>
            <CardDescription>
              The AI Jury will pick attribution from the members list. On a
              confirmed violation, the violator&apos;s stake is slashed and
              the compensation pool is split among the other members
              proportionally to their stake share.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <label className="text-xs uppercase text-slate-500">
                Suspect URL
              </label>
              <Input
                value={reportUrl}
                onChange={(e) => setReportUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase text-slate-500">
                Revealed keywords (one per line)
              </label>
              <Textarea
                rows={3}
                value={reportKeywords}
                onChange={(e) => setReportKeywords(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase text-slate-500">
                Salt (from your vault file)
              </label>
              <Input
                value={salt}
                onChange={(e) => setSalt(e.target.value)}
                placeholder="hex salt"
              />
            </div>
            <Button
              variant="destructive"
              onClick={reportLeak}
              disabled={busy}
            >
              {busy ? "Awaiting consensus…" : "Submit report (1 GEN fee)"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {expired && group.status !== "expired" && group.status !== "leaked" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> Expire and refund
            </CardTitle>
            <CardDescription>
              The group NDA is past its expiry. Anyone can call this to
              release every remaining stake into party withdrawables.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={expireGroup} disabled={busy}>
              Trigger expiry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {group.status === "leaked" && parsedVerdict ? (
        <Card className="border-rose-300 bg-rose-50/40 dark:bg-rose-950/20">
          <CardHeader>
            <CardTitle>Verdict</CardTitle>
            <CardDescription>
              Violator:{" "}
              <a
                className="hover:underline font-mono"
                href={explorerAddressUrl(group.violator)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {group.violator}
              </a>
              . Slashed: {formatGenAmount(group.slashed_amount.toString())} GEN.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-white dark:bg-slate-950 rounded p-3 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(parsedVerdict, null, 2)}
            </pre>
            {group.suspect_url ? (
              <p className="text-xs mt-2">
                Primary source:{" "}
                <a
                  href={group.suspect_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {group.suspect_url}
                </a>
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
        <Link href="/groups" className="underline">
          ← Back to group NDAs
        </Link>
      </div>
    </div>
  )
}
