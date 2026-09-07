"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Handshake,
  ShieldCheck,
  Copy,
  ArrowUpRight,
  Trash2,
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
import { parseContractError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface EndorseScore {
  address: string
  weight_sum: string
  count_received: string
  count_given: string
  score: string
}

function buildChallenge(target: string): string {
  return `NDA-Sentinel ENDORSE ${target} ${new Date().toISOString().slice(0, 10)}`
}

export default function EndorsePage() {
  const [target, setTarget] = useState("")
  const [weight, setWeight] = useState(50)
  const [proofUrl, setProofUrl] = useState("")
  const [challenge, setChallenge] = useState("")
  const [myScore, setMyScore] = useState<EndorseScore | null>(null)
  const [receivedMap, setReceivedMap] = useState<Record<string, { weight: number; at: number; proof_url: string }>>({})
  const [givenList, setGivenList] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeAddress) return
    try {
      const [scoreRaw, recvRaw, givenRaw] = await Promise.all([
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_endorsement_score",
          args: [activeAddress],
        }) as Promise<string>,
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_endorsements_received",
          args: [activeAddress],
        }) as Promise<string>,
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_endorsements_given",
          args: [activeAddress],
        }) as Promise<string>,
      ])
      setMyScore(JSON.parse(scoreRaw))
      setReceivedMap(JSON.parse(recvRaw))
      setGivenList(JSON.parse(givenRaw))
    } catch {
      /* empty */
    }
  }, [])

  useEffect(() => {
    load()
    const h = () => load()
    window.addEventListener(WALLET_CHANGED_EVENT, h)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, h)
  }, [load])

  useEffect(() => {
    if (target && /^0x[a-fA-F0-9]{40}$/.test(target)) {
      setChallenge((prev) => prev || buildChallenge(target.toLowerCase()))
    }
  }, [target])

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

  const submitEndorse = () =>
    runWrite(() => {
      if (!/^0x[a-fA-F0-9]{40}$/.test(target)) throw new Error("Target must be a valid address.")
      if (!proofUrl) throw new Error("Publish the proof text and paste its URL.")
      if (!challenge) throw new Error("Challenge phrase required.")
      return client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "endorse_user",
        args: [target.toLowerCase(), proofUrl, challenge, BigInt(weight)],
        value: BigInt(0),
      })
    })

  const revoke = (t: string) =>
    runWrite(() =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "revoke_endorsement",
        args: [t],
        value: BigInt(0),
      }),
    )

  const proofTemplate =
    target && /^0x[a-fA-F0-9]{40}$/.test(target) && activeAddress
      ? `NDA Sentinel endorsement\n\n` +
        `Kind: ENDORSE\n` +
        `Endorser: ${activeAddress.toLowerCase()}\n` +
        `Target: ${target.toLowerCase()}\n` +
        `Challenge: ${challenge || buildChallenge(target.toLowerCase())}\n` +
        `Weight: ${weight}\n\n` +
        `I, the endorser above, attest that the target address represents a\n` +
        `reliable and trustworthy party for NDA Sentinel interactions.\n`
      : ""

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Handshake className="w-5 h-5" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Endorsement web
          </h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl text-sm">
          Vouch for another wallet. Every endorsement is AI-attested — you
          publish a proof page you control, GenLayer validators fetch and
          confirm it names both parties + the challenge before the trust
          edge is written on-chain.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase text-slate-500">Score</div>
              <div className="mt-1 font-semibold text-lg">
                {myScore?.score ?? "0"}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase text-slate-500">Received</div>
              <div className="mt-1 font-semibold">
                {myScore?.count_received ?? "0"}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase text-slate-500">Given</div>
              <div className="mt-1 font-semibold">
                {myScore?.count_given ?? "0"}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase text-slate-500">Sum weight</div>
              <div className="mt-1 font-semibold">
                {myScore?.weight_sum ?? "0"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endorse someone</CardTitle>
          <CardDescription>
            Publish the proof text at a URL you control, then submit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Target address</Label>
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="0x…"
              />
            </div>
            <div>
              <Label>Weight (1-100)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Proof URL</Label>
              <Input
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Challenge phrase</Label>
              <Input
                value={challenge}
                onChange={(e) => setChallenge(e.target.value)}
              />
            </div>
          </div>
          {proofTemplate ? (
            <div className="space-y-2">
              <Label className="text-xs">Proof template</Label>
              <textarea
                readOnly
                rows={6}
                value={proofTemplate}
                className="w-full text-xs font-mono bg-slate-100 dark:bg-slate-900 rounded p-3"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard?.writeText(proofTemplate)
                }}
              >
                <Copy className="w-4 h-4 mr-1" /> Copy template
              </Button>
            </div>
          ) : null}
          <Button
            onClick={submitEndorse}
            disabled={busy || !target || !proofUrl}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <ShieldCheck className="w-4 h-4 mr-1" /> Endorse on-chain
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endorsements you gave</CardTitle>
          <CardDescription>Revoke any at will.</CardDescription>
        </CardHeader>
        <CardContent>
          {givenList.length === 0 ? (
            <p className="text-sm text-slate-500 italic">None yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {givenList.map((t) => (
                <li key={t} className="flex items-center gap-2 border rounded-md p-2">
                  <a
                    href={explorerAddressUrl(t)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs hover:underline flex-1"
                  >
                    {t.slice(0, 10)}…{t.slice(-8)}{" "}
                    <ArrowUpRight className="w-3 h-3 inline" />
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600"
                    onClick={() => revoke(t)}
                    disabled={busy}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endorsements you received</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(receivedMap).length === 0 ? (
            <p className="text-sm text-slate-500 italic">None yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {Object.entries(receivedMap).map(([endorser, meta]) => (
                <li key={endorser} className="border rounded-md p-2 flex flex-wrap items-center gap-2">
                  <a
                    href={explorerAddressUrl(endorser)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs hover:underline"
                  >
                    {endorser.slice(0, 10)}…{endorser.slice(-8)}
                  </a>
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    weight {meta.weight}
                  </Badge>
                  <a
                    href={meta.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-auto"
                  >
                    proof URL <ArrowUpRight className="w-3 h-3 inline" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {error ? (
        <div className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 rounded-md p-3">
          {error}
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
        Also check out{" "}
        <Link href="/bounties" className="underline">
          the bounty board
        </Link>
        .
      </div>
    </div>
  )
}
