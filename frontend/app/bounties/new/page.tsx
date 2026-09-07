"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Coins, ShieldAlert } from "lucide-react"
import {
  assertWritable,
  client,
  CONTRACT_ADDRESS,
  ensureCorrectChainBeforeWrite,
  explorerTxUrl,
  WalletNotReadyError,
} from "@/lib/genlayer"
import { parseGenAmount } from "@/lib/amount"
import { parseContractError } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

function tomorrowIso(): string {
  const t = new Date()
  t.setDate(t.getDate() + 1)
  t.setHours(12, 0, 0, 0)
  return t.toISOString().slice(0, 16)
}

export default function NewBountyPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [rubric, setRubric] = useState("")
  const [deadline, setDeadline] = useState(tomorrowIso())
  const [reward, setReward] = useState("0.5")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setTxHash(null)
    if (title.length < 4) return setError("Title too short.")
    if (description.length < 20) return setError("Description must be at least 20 chars.")
    if (rubric.length < 20) return setError("Rubric must be at least 20 chars — the AI Jury uses it to score entries.")
    const dl = Math.floor(new Date(deadline).getTime() / 1000)
    if (dl - Math.floor(Date.now() / 1000) < 3600)
      return setError("Deadline must be at least 1 hour in the future.")
    setBusy(true)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = (await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "create_bounty",
        args: [title, description, rubric, BigInt(dl)],
        value: parseGenAmount(reward),
      })) as `0x${string}`
      setTxHash(hash)
      await client.waitForTransactionReceipt({
        hash: hash as unknown as `0x${string}` & { length: 66 },
        status: "ACCEPTED" as never,
        retries: 120,
        interval: 3000,
      })
      router.push("/bounties")
    } catch (err) {
      if (err instanceof WalletNotReadyError) setError(err.message)
      else setError(parseContractError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 md:px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Coins className="w-5 h-5" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Post a bounty
          </h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl text-sm">
          Reward pool is locked at creation. After the deadline anyone can
          call the adjudication path — validators fetch every entry&apos;s
          proof URL and consensus-score against your rubric. Winners are
          paid pro-rata in a single tx.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Rubric quality is critical — it&apos;s the ONLY guidance the
            AI Jury has. Be specific about what a winning entry looks
            like.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title (4-120 chars)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Public description (20-800 chars)</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you paying for?"
            />
          </div>
          <div>
            <Label>Adjudication rubric (20-1000 chars)</Label>
            <Textarea
              rows={5}
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              placeholder={
                "e.g. Score 100 if the entry ships a working demo, cites 3+ NDA Sentinel primitives, and includes a screencast. Score 50 for a draft demo. Score 0 for a description-only entry."
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Deadline (local time)</Label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <div>
              <Label>Reward pool (GEN, min 0.1)</Label>
              <Input
                type="number"
                step="0.1"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 rounded-md p-3 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5" />
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={busy} className="bg-amber-600 hover:bg-amber-700">
          {busy ? "Awaiting consensus…" : "Post bounty"}
        </Button>
        {txHash ? (
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline"
          >
            {txHash.slice(0, 10)}…{txHash.slice(-8)}
          </a>
        ) : null}
      </div>
    </div>
  )
}
