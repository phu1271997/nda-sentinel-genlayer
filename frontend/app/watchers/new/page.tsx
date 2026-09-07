"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, ShieldAlert } from "lucide-react"
import {
  activeAddress,
  assertWritable,
  client,
  CONTRACT_ADDRESS,
  ensureCorrectChainBeforeWrite,
  explorerTxUrl,
  WalletNotReadyError,
} from "@/lib/genlayer"
import { parseGenAmount } from "@/lib/amount"
import { parseContractError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const COOLDOWN_PRESETS: [string, number][] = [
  ["5 min", 300],
  ["1 hour", 3600],
  ["6 hours", 6 * 3600],
  ["1 day", 24 * 3600],
  ["7 days", 7 * 24 * 3600],
]

export default function NewWatcherPage() {
  const router = useRouter()
  const [label, setLabel] = useState("")
  const [url, setUrl] = useState("")
  const [rule, setRule] = useState("")
  const [recipient, setRecipient] = useState("")
  const [ndaLink, setNdaLink] = useState("0")
  const [cooldown, setCooldown] = useState(3600)
  const [rewardPerHit, setRewardPerHit] = useState("0.02")
  const [pool, setPool] = useState("0.2")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setTxHash(null)
    const notify = recipient || activeAddress
    if (!/^0x[a-fA-F0-9]{40}$/.test(notify)) return setError("Recipient must be a valid address.")
    if (label.length < 3) return setError("Label too short.")
    if (!/^https?:\/\//.test(url)) return setError("URL must be http:// or https://.")
    if (rule.length < 10) return setError("Rule must be at least 10 chars.")
    setBusy(true)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = (await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "create_watcher",
        args: [
          label,
          url,
          rule,
          notify.toLowerCase(),
          BigInt(ndaLink || "0"),
          BigInt(cooldown),
          parseGenAmount(rewardPerHit),
        ],
        value: parseGenAmount(pool),
      })) as `0x${string}`
      setTxHash(hash)
      await client.waitForTransactionReceipt({
        hash: hash as unknown as `0x${string}` & { length: 66 },
        status: "ACCEPTED" as never,
        retries: 120,
        interval: 3000,
      })
      router.push("/watchers")
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
        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
          <Eye className="w-5 h-5" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Create a watcher
          </h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl text-sm">
          Any public URL. Any plain-English match rule. Pool a reward.
          The community polls it — you pay only when the AI Jury reaches
          consensus on a hit.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Rule quality drives false-positive rate. Be specific about
            what a hit looks like — e.g. &quot;any mention of Series C
            valuation OR term sheet with Sequoia&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Label (short name)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Acme blog leak monitor" />
          </div>
          <div>
            <Label>URL to watch</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label>Match rule (10-500 chars)</Label>
            <Textarea
              rows={4}
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              placeholder="e.g. Any post that reveals specific financial figures for Series C round or mentions the words 'term sheet' with a company name."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Notify recipient (default: you)</Label>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={activeAddress}
              />
            </div>
            <div>
              <Label>Link to NDA (optional)</Label>
              <Input
                type="number"
                value={ndaLink}
                onChange={(e) => setNdaLink(e.target.value)}
                placeholder="0 = standalone"
              />
            </div>
            <div>
              <Label>Cooldown between hits</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COOLDOWN_PRESETS.map(([lab, secs]) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => setCooldown(secs)}
                    className={
                      "text-xs rounded-md border px-2 py-1 " +
                      (cooldown === secs
                        ? "bg-purple-600 text-white border-purple-600"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800")
                    }
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Reward per hit (GEN)</Label>
              <Input
                type="number"
                step="0.01"
                value={rewardPerHit}
                onChange={(e) => setRewardPerHit(e.target.value)}
              />
            </div>
            <div>
              <Label>Reward pool (GEN, ≥ 0.1)</Label>
              <Input
                type="number"
                step="0.1"
                value={pool}
                onChange={(e) => setPool(e.target.value)}
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
        <Button onClick={submit} disabled={busy} className="bg-purple-600 hover:bg-purple-700">
          {busy ? "Awaiting consensus…" : "Create watcher"}
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
