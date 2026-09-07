"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  KeyRound,
  LockKeyhole,
  UnlockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Download,
  Trash2,
  CheckCircle2,
  Copy,
  ArrowRight,
  Sparkles,
  RefreshCcw,
  Ban,
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
import {
  clearSealedKeystore,
  generateAndSeal,
  getUnlockedKeypair,
  loadSealedKeystore,
  lockKeystore,
  unlockKeystore,
} from "@/lib/keyring"
import { parseContractError } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type KeyStatus = "unverified" | "verified" | "rotating" | "revoked" | ""

interface KeyCard {
  address: string
  pubkey: string
  algo: string
  status: KeyStatus
  rotation_counter: string
  proof_url: string
  challenge: string
  registered_at: string
  history_len: number
  last_history_entry: unknown
}

async function fetchKeyCard(user: string): Promise<KeyCard | null> {
  try {
    const raw = (await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_encryption_key_card",
      args: [user],
    })) as string
    const parsed = JSON.parse(raw) as KeyCard
    if (!parsed.pubkey) return null
    return parsed
  } catch {
    return null
  }
}

const STATUS_STYLES: Record<string, string> = {
  verified: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  unverified: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  rotating: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  revoked: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
}

function buildChallenge(kind: "REGISTER" | "ROTATE" | "REVOKE", address: string): string {
  const day = new Date().toISOString().slice(0, 10)
  return `NDA-Sentinel ${kind} ${address} ${day}`
}

export default function KeysPage() {
  const [addr, setAddr] = useState<string>("")
  const [sealedPresent, setSealedPresent] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [localPubkey, setLocalPubkey] = useState<string>("")
  const [keyCard, setKeyCard] = useState<KeyCard | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [proofUrl, setProofUrl] = useState("")
  const [challenge, setChallenge] = useState("")
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const a = activeAddress
    setAddr(a)
    const sealed = loadSealedKeystore(a)
    setSealedPresent(!!sealed)
    const kp = getUnlockedKeypair(a)
    setUnlocked(!!kp)
    setLocalPubkey(kp?.publicKeyHex ?? sealed?.publicKeyHex ?? "")
    const card = await fetchKeyCard(a)
    setKeyCard(card)
    setChallenge((prev) => prev || buildChallenge("REGISTER", a))
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener(WALLET_CHANGED_EVENT, handler)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, handler)
  }, [refresh])

  const status: KeyStatus = keyCard?.status ?? ""
  const isVerified = status === "verified"
  const isRevoked = status === "revoked"
  const isRegistered = !!keyCard?.pubkey
  const registrySynced =
    isRegistered &&
    !!localPubkey &&
    keyCard!.pubkey.toLowerCase() === localPubkey.toLowerCase()

  const handleGenerate = async () => {
    setMessage(null)
    if (!password || password.length < 8) {
      setMessage({ kind: "err", text: "Password must be at least 8 characters" })
      return
    }
    if (password !== confirmPassword) {
      setMessage({ kind: "err", text: "Passwords do not match" })
      return
    }
    setBusy(true)
    try {
      const kp = await generateAndSeal(addr, password)
      setSealedPresent(true)
      setUnlocked(true)
      setLocalPubkey(kp.publicKeyHex)
      setPassword("")
      setConfirmPassword("")
      setChallenge(buildChallenge("REGISTER", addr))
      setMessage({
        kind: "ok",
        text: "Keypair generated. Next: host a proof page, then attest on-chain (see step 2).",
      })
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const handleUnlock = async () => {
    setMessage(null)
    setBusy(true)
    try {
      const kp = await unlockKeystore(addr, password)
      setUnlocked(true)
      setLocalPubkey(kp.publicKeyHex)
      setPassword("")
      setMessage({ kind: "ok", text: "Keystore unlocked for this session." })
    } catch {
      setMessage({ kind: "err", text: "Wrong password (or keystore corrupted)." })
    } finally {
      setBusy(false)
    }
  }

  const handleLock = () => {
    lockKeystore(addr)
    setUnlocked(false)
    setMessage({ kind: "ok", text: "Private key wiped from memory." })
  }

  const handleDelete = () => {
    if (!confirm("Delete the sealed keystore for this address? You will lose access to any encrypted NDA envelope addressed to this key unless you have social recovery guardians.")) {
      return
    }
    clearSealedKeystore(addr)
    lockKeystore(addr)
    setSealedPresent(false)
    setUnlocked(false)
    setLocalPubkey("")
    setMessage({ kind: "ok", text: "Sealed keystore deleted from this browser." })
  }

  const handleExport = () => {
    const sealed = loadSealedKeystore(addr)
    if (!sealed) return
    const blob = new Blob([JSON.stringify(sealed, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `nda-sentinel-keystore-${addr.slice(0, 8)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (parsed.version !== 1 || parsed.algo !== "ecdh-p256") {
        throw new Error("Unrecognised keystore format")
      }
      window.localStorage.setItem(
        `nda-sentinel:enc-keystore:${addr.toLowerCase()}`,
        JSON.stringify(parsed),
      )
      setSealedPresent(true)
      setLocalPubkey(parsed.publicKeyHex)
      setMessage({
        kind: "ok",
        text: "Keystore imported. Unlock it below with the password you used at export.",
      })
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message })
    }
  }

  const attestKind: "REGISTER" | "ROTATE" = isVerified ? "ROTATE" : "REGISTER"

  const proofTemplate =
    localPubkey && addr
      ? `NDA Sentinel key attestation\n\n` +
        `Kind: ${attestKind}\n` +
        `Address: ${addr.toLowerCase()}\n` +
        `Public key: ${localPubkey}\n` +
        `Challenge: ${challenge || buildChallenge(attestKind, addr)}\n\n` +
        `I authorize the NDA Sentinel protocol to bind the on-chain address\n` +
        `above to the public encryption key above. This message is public.\n`
      : ""

  const copyTemplate = async () => {
    if (!proofTemplate) return
    await navigator.clipboard?.writeText(proofTemplate)
    setMessage({ kind: "ok", text: "Proof template copied. Publish it verbatim at a public URL you control." })
  }

  const attestOnChain = async () => {
    setMessage(null)
    setTxHash(null)
    if (!localPubkey) return setMessage({ kind: "err", text: "Generate or unlock a keypair first." })
    if (!proofUrl) return setMessage({ kind: "err", text: "Enter the URL where you published the proof." })
    if (!challenge) return setMessage({ kind: "err", text: "Challenge phrase required (auto-filled by default)." })

    setBusy(true)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const functionName =
        attestKind === "ROTATE"
          ? "rotate_encryption_key"
          : "register_encryption_key_with_proof"
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args: [localPubkey, "ecdh-p256", proofUrl, challenge],
        value: BigInt(0),
      })
      setTxHash(hash)
      await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED" as never,
        retries: 120,
        interval: 3000,
      })
      await refresh()
      setMessage({
        kind: "ok",
        text:
          attestKind === "ROTATE"
            ? "Rotation attested — new key is live."
            : "Key attested by consensus and marked VERIFIED. Encrypted NDAs unlocked.",
      })
    } catch (err) {
      if (err instanceof WalletNotReadyError) {
        setMessage({ kind: "err", text: err.message })
      } else {
        setMessage({ kind: "err", text: parseContractError(err) })
      }
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    setMessage(null)
    setTxHash(null)
    if (!proofUrl) return setMessage({ kind: "err", text: "Enter a revocation reason URL." })
    if (!challenge) return setMessage({ kind: "err", text: "Challenge phrase required." })
    if (!confirm("Revoke your encryption key on-chain? Existing encrypted NDAs stay decryptable locally, but no new NDAs can be encrypted to this key.")) return
    setBusy(true)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "revoke_encryption_key",
        args: [proofUrl, challenge],
        value: BigInt(0),
      })
      setTxHash(hash)
      await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED" as never,
        retries: 120,
        interval: 3000,
      })
      await refresh()
      setMessage({ kind: "ok", text: "Key revoked on-chain." })
    } catch (err) {
      if (err instanceof WalletNotReadyError) setMessage({ kind: "err", text: err.message })
      else setMessage({ kind: "err", text: parseContractError(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-5 h-5" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Verified encryption keys
          </h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
          Every state change on your encryption key — registration,
          rotation, revocation, guardian-assisted recovery — is attested
          by the GenLayer AI Jury through <code>eq_principle</code>.
          Validators independently fetch a proof URL you host and reach
          consensus on a four-fact check before the contract accepts the
          write. Encrypted NDAs require a VERIFIED key on both sides.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Link
            href="/keys/recovery"
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCcw className="w-3 h-3" /> Social recovery guardians
          </Link>
          <Link
            href="/keys/history"
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Sparkles className="w-3 h-3" /> Transparency log
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status for {addr.slice(0, 6)}…{addr.slice(-4)}</CardTitle>
          <CardDescription>
            Session-scoped unlock. Refresh or close the tab and the private
            key falls back to the sealed keystore.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Sealed keystore
              </div>
              <div className="mt-1 font-semibold">
                {sealedPresent ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    Present
                  </Badge>
                ) : (
                  <Badge variant="outline">Missing</Badge>
                )}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Session unlock
              </div>
              <div className="mt-1 font-semibold">
                {unlocked ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    <UnlockKeyhole className="w-3 h-3 mr-1" /> Unlocked
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <LockKeyhole className="w-3 h-3 mr-1" /> Locked
                  </Badge>
                )}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                On-chain status
              </div>
              <div className="mt-1 font-semibold">
                {isRegistered ? (
                  <Badge className={STATUS_STYLES[status] ?? ""}>{status}</Badge>
                ) : (
                  <Badge variant="outline">Unregistered</Badge>
                )}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Rotation count
              </div>
              <div className="mt-1 font-semibold">
                {keyCard?.rotation_counter ?? "0"}
              </div>
            </div>
          </div>

          {localPubkey ? (
            <div className="space-y-1">
              <Label className="text-xs">Public key (share freely)</Label>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono break-all p-2 bg-slate-100 dark:bg-slate-900 rounded flex-1">
                  {localPubkey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(localPubkey)
                    setMessage({ kind: "ok", text: "Public key copied." })
                  }}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {registrySynced && keyCard?.proof_url ? (
            <div className="text-xs text-slate-500">
              Attested by consensus. Proof:{" "}
              <a
                className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                href={keyCard.proof_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {keyCard.proof_url}
              </a>
            </div>
          ) : null}

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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 1 — Local keypair</CardTitle>
          <CardDescription>
            {sealedPresent
              ? "Enter your password to decrypt the sealed private key for this session."
              : "Pick a strong password. It never leaves this browser and cannot be recovered without your guardians."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-md p-3">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              Forgetting this password only matters if you also lose your
              social-recovery guardians. Configure them at{" "}
              <Link href="/keys/recovery" className="underline">
                /keys/recovery
              </Link>{" "}
              once your key is verified.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={sealedPresent ? "••••••••" : "min 8 chars"}
              />
            </div>
            {!sealedPresent && (
              <div>
                <Label htmlFor="pw2">Confirm password</Label>
                <Input
                  id="pw2"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {sealedPresent ? (
              <>
                <Button onClick={handleUnlock} disabled={busy || !password}>
                  <UnlockKeyhole className="w-4 h-4 mr-2" /> Unlock
                </Button>
                <Button variant="outline" onClick={handleLock} disabled={!unlocked}>
                  <LockKeyhole className="w-4 h-4 mr-2" /> Lock
                </Button>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" /> Export sealed
                </Button>
                <Button
                  variant="outline"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleGenerate} disabled={busy || !password}>
                  <KeyRound className="w-4 h-4 mr-2" /> Generate & seal
                </Button>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer border rounded-md px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Download className="w-4 h-4 rotate-180" /> Import
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={handleImport}
                  />
                </label>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Step 2 — {attestKind === "ROTATE" ? "Rotate on-chain" : "Attest on-chain"}
          </CardTitle>
          <CardDescription>
            Publish the proof text below at a URL you control (GitHub gist,
            personal blog, Twitter status page). The GenLayer AI Jury
            fetches it via <code>web.render</code> inside{" "}
            <code>eq_principle</code> and consensus-verifies a four-fact
            check before the mapping is written.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Proof template (copy this verbatim)</Label>
            <textarea
              readOnly
              rows={7}
              value={proofTemplate}
              className="w-full text-xs font-mono bg-slate-100 dark:bg-slate-900 rounded p-3"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyTemplate} disabled={!proofTemplate}>
                <Copy className="w-4 h-4 mr-1" /> Copy template
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="proof-url">Proof URL (published page)</Label>
              <Input
                id="proof-url"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="https://gist.github.com/…"
              />
            </div>
            <div>
              <Label htmlFor="challenge">Challenge phrase</Label>
              <Input
                id="challenge"
                value={challenge}
                onChange={(e) => setChallenge(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={attestOnChain}
              disabled={busy || !localPubkey || !proofUrl || isRevoked}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              {attestKind === "ROTATE" ? "Rotate key" : "Attest on-chain"}
            </Button>
            {isVerified && !isRevoked ? (
              <Button
                variant="outline"
                onClick={revoke}
                disabled={busy}
                className="text-rose-600 hover:text-rose-700"
              >
                <Ban className="w-4 h-4 mr-2" /> Revoke
              </Button>
            ) : null}
          </div>
          {isRevoked ? (
            <div className="text-xs text-rose-600 dark:text-rose-400">
              Key is REVOKED on-chain. Use social recovery to attest a new
              key without recovering the old private key.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Separator />

      <div className="text-xs text-slate-500 space-y-2">
        <p>
          <strong>Why AI-attested?</strong> A deterministic self-declared
          pubkey (the pre-v0.2.26 path) can be forged trivially — anyone
          can register any pubkey against their own address. The
          eq_principle attestation binds the address to a page the address
          demonstrably controls (a GitHub gist under their handle, a
          Twitter status page, a personal blog they own), so counterparties
          can trust that the pubkey they encrypt for is genuinely under the
          named party&apos;s control. If the private key is ever lost, the
          social-recovery flow lets K-of-N guardians co-attest the same
          way for a replacement pubkey.
        </p>
      </div>
    </div>
  )
}
