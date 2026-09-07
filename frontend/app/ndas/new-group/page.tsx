"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Users, Plus, Trash2, ShieldAlert, Download } from "lucide-react"
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
import { generateSalt, hashKeyword } from "@/lib/crypto"
import { downloadVaultFile } from "@/lib/vault"
import { parseContractError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ALLOWED_SCOPES = [
  "ma_pricing", "product_roadmap", "source_code", "personal_info",
  "financial_data", "trade_secret", "employment_terms", "litigation_info",
  "research_data", "customer_list", "other",
]

function tomorrowIsoDate(): string {
  const t = new Date()
  t.setDate(t.getDate() + 1)
  t.setHours(0, 0, 0, 0)
  return t.toISOString().slice(0, 10)
}

export default function NewGroupNDAPage() {
  const router = useRouter()
  const [scope, setScope] = useState("")
  const [context, setContext] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [stake, setStake] = useState("100")
  const [parties, setParties] = useState<string[]>([""])
  const [threshold, setThreshold] = useState<number>(0) // 0 = default "all"
  const [keywordsText, setKeywordsText] = useState("")
  const [vaultPassword, setVaultPassword] = useState("")
  const [salt, setSalt] = useState("")
  const [keywordsList, setKeywordsList] = useState<string[]>([])
  const [downloaded, setDownloaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const totalParties = 1 + parties.filter((p) => /^0x[a-fA-F0-9]{40}$/.test(p)).length

  const addParty = () => setParties((p) => [...p, ""])
  const removeParty = (i: number) => setParties((p) => p.filter((_, idx) => idx !== i))
  const setPartyAt = (i: number, v: string) =>
    setParties((p) => p.map((x, idx) => (idx === i ? v : x)))

  const generateSaltHere = () => {
    setSalt(generateSalt())
    setKeywordsList(
      keywordsText.split("\n").map((k) => k.trim()).filter((k) => k.length > 0),
    )
  }

  const downloadVault = () => {
    if (!vaultPassword) {
      alert("Enter a vault password first.")
      return
    }
    downloadVaultFile(
      { keywords: keywordsList, salt, nda_context: context },
      vaultPassword,
      "group_nda_secret_vault.json",
    )
    setDownloaded(true)
  }

  const submit = async () => {
    setError(null)
    setTxHash(null)
    if (!scope) return setError("Pick a scope.")
    if (context.length < 10) return setError("Context must be at least 10 chars.")
    if (!expiryDate) return setError("Expiry date is required.")
    if (Date.parse(expiryDate) <= Date.now() + 60_000)
      return setError("Expiry must be a future date.")
    if (keywordsList.length === 0) return setError("Generate the salt / hashes first.")
    if (!downloaded) return setError("Download the Secret Vault before submitting.")

    const cleanParties = [
      activeAddress.toLowerCase(),
      ...parties
        .map((p) => p.trim().toLowerCase())
        .filter((p) => /^0x[a-fA-F0-9]{40}$/.test(p)),
    ]
    const dedup = Array.from(new Set(cleanParties))
    if (dedup.length < 3) return setError("Need at least 3 unique parties (including you).")
    if (dedup.length > 10) return setError("Maximum 10 parties per group NDA.")

    const thr = threshold > 0 ? threshold : dedup.length
    if (thr < 1 || thr > dedup.length) return setError("Invalid threshold.")

    setBusy(true)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hashes = keywordsList.map((k) => hashKeyword(k, salt))
      const expiryTs = BigInt(Math.floor(new Date(expiryDate).getTime() / 1000))
      const stakeWei = parseGenAmount(stake)
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "create_group_nda",
        args: [
          JSON.stringify(dedup),
          scope,
          context,
          expiryTs,
          BigInt(thr),
          JSON.stringify(hashes),
        ],
        value: stakeWei,
      })
      setTxHash(hash)
      await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED" as never,
        retries: 120,
        interval: 3000,
      })
      router.push("/groups")
    } catch (err) {
      if (err instanceof WalletNotReadyError) setError(err.message)
      else setError(parseContractError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
          <Users className="w-5 h-5" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Multi-Party NDA
          </h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
          3–10 parties, tiered activation, threshold consensus. When a leak
          is confirmed, the violator&apos;s stake is slashed and the
          compensation pool is split among the other parties proportionally
          to their own stakes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parties</CardTitle>
          <CardDescription>
            You ({activeAddress.slice(0, 6)}…{activeAddress.slice(-4)}) are
            automatically party #1. Add the counterparties below. Each will
            get a Group-NDA proposal in their inbox and must call{" "}
            <code>join_group_nda</code> with their own stake.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {parties.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="0x…"
                value={p}
                onChange={(e) => setPartyAt(i, e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => removeParty(i)}
                disabled={parties.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addParty} disabled={parties.length >= 9}>
            <Plus className="w-4 h-4 mr-1" /> Add party
          </Button>
          <div className="text-xs text-slate-500">
            Total unique parties (including you):{" "}
            <strong>{totalParties}</strong>. Threshold below defaults to
            all parties.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NDA terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Scope</Label>
              <Select onValueChange={(v) => setScope(v ?? "")} value={scope}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {ALLOWED_SCOPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expiry</Label>
              <Input
                type="date"
                min={tomorrowIsoDate()}
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Your stake (GEN)</Label>
              <Input
                type="number"
                step="0.1"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
              />
            </div>
            <div>
              <Label>Threshold (parties required)</Label>
              <Input
                type="number"
                min={0}
                max={totalParties}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                placeholder="0 = all parties"
              />
            </div>
          </div>
          <div>
            <Label>Public context</Label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. Joint DD on Acme acquisition — three co-investors"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Protected keywords</CardTitle>
          <CardDescription>
            One per line. Never leaves this browser — hashed locally, only
            the hashes go on-chain (same commit-and-reveal design as 1:1
            NDAs).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={4}
            placeholder={"$45M Series B\n0.7% discount"}
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
          />
          {!salt ? (
            <Button variant="secondary" onClick={generateSaltHere}>
              Generate salt & hashes
            </Button>
          ) : (
            <>
              <div className="text-xs bg-slate-100 dark:bg-slate-900 rounded p-2 font-mono break-all">
                salt: {salt}
              </div>
              <div className="grid gap-2">
                <Label>Vault password</Label>
                <Input
                  type="password"
                  value={vaultPassword}
                  onChange={(e) => setVaultPassword(e.target.value)}
                />
                <Button
                  onClick={downloadVault}
                  disabled={downloaded}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Download className="w-4 h-4 mr-1" />
                  {downloaded ? "Vault downloaded" : "Download vault"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {error ? (
        <div className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 rounded-md p-3 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5" />
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={submit}
          disabled={busy || !downloaded}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {busy ? "Awaiting consensus…" : "Create group NDA"}
        </Button>
        {txHash ? (
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono self-center"
          >
            {txHash.slice(0, 10)}…{txHash.slice(-8)}
          </a>
        ) : null}
      </div>
    </div>
  )
}
