"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Users,
  Plus,
  Trash2,
  ShieldCheck,
  RefreshCcw,
  Copy,
  ArrowRight,
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
import { generateEncryptionKeypair } from "@/lib/e2ee"
import { parseContractError } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface RecoveryState {
  guardians: string[]
  threshold: string
  active: boolean
  pending_new_pubkey: string
  pending_new_algo: string
  started_at: string
  approvals: Record<string, { at: number; url: string }>
  approvals_count: string
}

function buildChallenge(kind: string, address: string): string {
  return `NDA-Sentinel ${kind} ${address} ${new Date().toISOString().slice(0, 10)}`
}

export default function RecoveryPage() {
  const [state, setState] = useState<RecoveryState | null>(null)
  const [guardianInputs, setGuardianInputs] = useState<string[]>([""])
  const [threshold, setThreshold] = useState<number>(2)
  const [newPubkey, setNewPubkey] = useState<string>("")
  const [approvalUrl, setApprovalUrl] = useState<string>("")
  const [approvalTargetUser, setApprovalTargetUser] = useState<string>("")
  const [approvalChallenge, setApprovalChallenge] = useState<string>("")
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeAddress) return
    try {
      const raw = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_recovery_status",
        args: [activeAddress],
      })) as string
      setState(JSON.parse(raw))
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message })
    }
  }, [])

  useEffect(() => {
    load()
    const handler = () => load()
    window.addEventListener(WALLET_CHANGED_EVENT, handler)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, handler)
  }, [load])

  const runWrite = async (fn: () => Promise<unknown>) => {
    setMessage(null)
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
      setMessage({ kind: "ok", text: "Confirmed on-chain." })
    } catch (err) {
      if (err instanceof WalletNotReadyError) setMessage({ kind: "err", text: err.message })
      else setMessage({ kind: "err", text: parseContractError(err) })
    } finally {
      setBusy(false)
    }
  }

  const saveGuardians = () =>
    runWrite(() => {
      const list = guardianInputs
        .map((g) => g.trim().toLowerCase())
        .filter((g) => /^0x[a-fA-F0-9]{40}$/.test(g))
      if (list.length < 2 || list.length > 7)
        throw new Error("Need 2-7 guardian addresses.")
      if (threshold < 2 || threshold > list.length)
        throw new Error(`Threshold must be 2-${list.length}.`)
      return client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "set_recovery_guardians",
        args: [JSON.stringify(list), BigInt(threshold)],
        value: BigInt(0),
      })
    })

  const initiateRecovery = () =>
    runWrite(async () => {
      if (!/^[0-9a-fA-F]{130}$/.test(newPubkey))
        throw new Error("Enter a valid ECDH-P256 uncompressed pubkey (130 hex chars).")
      return client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "initiate_key_recovery",
        args: [newPubkey.toLowerCase(), "ecdh-p256"],
        value: BigInt(0),
      })
    })

  const generateNewKey = async () => {
    const kp = await generateEncryptionKeypair()
    setNewPubkey(kp.publicKeyHex)
    // Note: this new keypair is NOT sealed locally — the user must
    // separately import it into /keys once recovery completes. This
    // page's job is to move the on-chain state.
    setMessage({
      kind: "ok",
      text:
        "Generated a fresh recovery keypair in memory. Copy the private-key PKCS8 blob and store it safely — after finalization you import it at /keys.",
    })
    const kpBlob = JSON.stringify(
      {
        publicKeyHex: kp.publicKeyHex,
        privateKeyPkcs8B64: kp.privateKeyPkcs8B64,
        algo: kp.algo,
      },
      null,
      2,
    )
    const blob = new Blob([kpBlob], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `nda-sentinel-recovery-key-${activeAddress.slice(0, 8)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const approveAsGuardian = () =>
    runWrite(() => {
      if (!/^0x[a-fA-F0-9]{40}$/.test(approvalTargetUser))
        throw new Error("Enter the user address you are approving for.")
      if (!approvalUrl) throw new Error("Enter your guardian proof URL.")
      if (!approvalChallenge) throw new Error("Enter the challenge phrase.")
      return client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "guardian_approve_recovery",
        args: [approvalTargetUser.toLowerCase(), approvalUrl, approvalChallenge],
        value: BigInt(0),
      })
    })

  const addGuardianRow = () => setGuardianInputs((g) => [...g, ""])
  const removeGuardianRow = (i: number) =>
    setGuardianInputs((g) => g.filter((_, idx) => idx !== i))
  const setGuardianAt = (i: number, v: string) =>
    setGuardianInputs((g) => g.map((x, idx) => (idx === i ? v : x)))

  const guardianCount = state?.guardians.length ?? 0
  const guardianThreshold = Number(state?.threshold ?? 0)
  const approvalsCount = Number(state?.approvals_count ?? 0)

  const guardianTemplate =
    approvalTargetUser && state?.pending_new_pubkey
      ? `NDA Sentinel guardian approval\n\n` +
        `Kind: GUARDIAN_APPROVE\n` +
        `User being recovered: ${approvalTargetUser.toLowerCase()}\n` +
        `New public key: ${state.pending_new_pubkey}\n` +
        `Challenge: ${approvalChallenge || buildChallenge("GUARDIAN_APPROVE", approvalTargetUser)}\n\n` +
        `I, as a designated recovery guardian for the address above,\n` +
        `attest that this new encryption pubkey is the one the user has\n` +
        `asked me to authorize.\n`
      : ""

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Users className="w-5 h-5" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Social recovery guardians
          </h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
          Configure K-of-N guardians. If you ever lose the local private
          key that decrypts your encrypted NDAs, you can announce a
          replacement pubkey and your guardians co-attest — each guardian
          approval is independently verified by the GenLayer AI Jury via
          <code> eq_principle</code>. When K approvals accumulate, the
          new key is bound on-chain atomically.
        </p>
        <Link href="/keys" className="text-xs text-emerald-700 dark:text-emerald-300 underline">
          ← back to keys
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Guardian configuration</CardTitle>
          <CardDescription>
            {guardianCount > 0
              ? `Currently: ${guardianCount} guardians, threshold ${guardianThreshold} of ${guardianCount}.`
              : "Not configured yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state && state.guardians.length > 0 ? (
            <div className="rounded-md border p-3 space-y-1">
              {state.guardians.map((g) => (
                <a
                  key={g}
                  href={explorerAddressUrl(g)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-mono text-xs hover:underline text-blue-600 dark:text-blue-400 break-all"
                >
                  {g}
                </a>
              ))}
              <div className="text-xs text-slate-500 pt-2">
                Threshold: {guardianThreshold}
              </div>
            </div>
          ) : null}

          {guardianInputs.map((g, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="0x…"
                value={g}
                onChange={(e) => setGuardianAt(i, e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => removeGuardianRow(i)}
                disabled={guardianInputs.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={addGuardianRow} disabled={guardianInputs.length >= 7}>
              <Plus className="w-4 h-4 mr-1" /> Add row
            </Button>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Threshold</Label>
              <Input
                type="number"
                min={2}
                max={7}
                className="w-20"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </div>
            <Button
              onClick={saveGuardians}
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Save guardians
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Initiate recovery</CardTitle>
          <CardDescription>
            You call this when you have lost your local private key.
            Announce the replacement pubkey; guardians then attest each in
            turn until threshold is met.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state?.active ? (
            <div className="rounded-md border bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
              Recovery in flight. Pending pubkey fingerprint:{" "}
              <code className="text-xs">
                {state.pending_new_pubkey.slice(0, 16)}…
              </code>
              <div className="mt-2">
                Approvals: <strong>{approvalsCount}</strong> /{" "}
                <strong>{guardianThreshold}</strong> required
                {approvalsCount >= guardianThreshold ? (
                  <Badge className="ml-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    ready to finalize (auto)
                  </Badge>
                ) : null}
              </div>
            </div>
          ) : null}
          <Label className="text-xs">New pubkey (ECDH-P256 uncompressed hex, 130 chars)</Label>
          <div className="flex gap-2">
            <Input
              value={newPubkey}
              onChange={(e) => setNewPubkey(e.target.value)}
              placeholder="04…"
            />
            <Button variant="outline" onClick={generateNewKey}>
              Generate + download
            </Button>
          </div>
          <Button
            onClick={initiateRecovery}
            disabled={busy || !newPubkey || guardianCount === 0}
          >
            <ArrowRight className="w-4 h-4 mr-1" /> Announce recovery
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guardian approval (I am approving someone else)</CardTitle>
          <CardDescription>
            Called by a guardian on behalf of a user who has announced a
            recovery. Publish the proof text below at a URL you (the
            guardian) control, then submit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">User address being recovered</Label>
              <Input
                value={approvalTargetUser}
                onChange={(e) => setApprovalTargetUser(e.target.value)}
                placeholder="0x…"
              />
            </div>
            <div>
              <Label className="text-xs">Your guardian proof URL</Label>
              <Input
                value={approvalUrl}
                onChange={(e) => setApprovalUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Challenge phrase</Label>
            <Input
              value={approvalChallenge}
              onChange={(e) => setApprovalChallenge(e.target.value)}
              placeholder={buildChallenge("GUARDIAN_APPROVE", approvalTargetUser || "0x…")}
            />
          </div>
          {guardianTemplate ? (
            <div className="space-y-2">
              <Label className="text-xs">Approval proof template</Label>
              <textarea
                readOnly
                rows={6}
                value={guardianTemplate}
                className="w-full text-xs font-mono bg-slate-100 dark:bg-slate-900 rounded p-3"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard?.writeText(guardianTemplate)
                }}
              >
                <Copy className="w-4 h-4 mr-1" /> Copy template
              </Button>
            </div>
          ) : null}
          <Button
            onClick={approveAsGuardian}
            disabled={busy || !approvalTargetUser || !approvalUrl || !approvalChallenge}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <ShieldCheck className="w-4 h-4 mr-1" /> Approve on-chain
          </Button>
        </CardContent>
      </Card>

      {message ? (
        <div
          className={
            message.kind === "ok"
              ? "text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-3"
              : "text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 rounded-md p-3"
          }
        >
          {message.text}
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
    </div>
  )
}
