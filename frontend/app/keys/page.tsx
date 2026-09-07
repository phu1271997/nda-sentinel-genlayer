"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  KeyRound,
  LockKeyhole,
  UnlockKeyhole,
  ShieldAlert,
  Download,
  Trash2,
  CheckCircle2,
  Copy,
  ArrowRight,
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

interface RegistryEntry {
  pubkey: string
  algo: string
  registered_at: string
}

async function fetchRegistry(user: string): Promise<RegistryEntry | null> {
  try {
    const res = (await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_encryption_key",
      args: [user],
    })) as string
    const parsed = JSON.parse(res) as RegistryEntry
    if (!parsed.pubkey) return null
    return parsed
  } catch {
    return null
  }
}

export default function KeysPage() {
  const [addr, setAddr] = useState<string>("")
  const [sealedPresent, setSealedPresent] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [localPubkey, setLocalPubkey] = useState<string>("")
  const [registryEntry, setRegistryEntry] = useState<RegistryEntry | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  useEffect(() => {
    const refresh = async () => {
      const a = activeAddress
      setAddr(a)
      const sealed = loadSealedKeystore(a)
      setSealedPresent(!!sealed)
      const kp = getUnlockedKeypair(a)
      setUnlocked(!!kp)
      setLocalPubkey(kp?.publicKeyHex ?? sealed?.publicKeyHex ?? "")
      const reg = await fetchRegistry(a)
      setRegistryEntry(reg)
    }
    refresh()
    const handler = () => refresh()
    window.addEventListener(WALLET_CHANGED_EVENT, handler)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, handler)
  }, [])

  const registrySynced =
    !!registryEntry &&
    !!localPubkey &&
    registryEntry.pubkey.toLowerCase() === localPubkey.toLowerCase()

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
      setMessage({
        kind: "ok",
        text: "Keypair generated and sealed. Publish it on-chain to enable encrypted NDAs.",
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
    if (!confirm("Delete the sealed keystore for this address? You will lose access to any encrypted NDA payloads addressed to this key.")) {
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

  const handlePublish = async () => {
    setMessage(null)
    setTxHash(null)
    if (!localPubkey) {
      setMessage({ kind: "err", text: "Generate or unlock a keypair first" })
      return
    }
    setBusy(true)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "register_encryption_key",
        args: [localPubkey, "ecdh-p256"],
        value: BigInt(0),
      })
      setTxHash(hash)
      await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED" as never,
        retries: 60,
        interval: 3000,
      })
      const reg = await fetchRegistry(addr)
      setRegistryEntry(reg)
      setMessage({ kind: "ok", text: "Public key registered on-chain." })
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

  const copyPubkey = () => {
    if (!localPubkey) return
    navigator.clipboard?.writeText(localPubkey)
    setMessage({ kind: "ok", text: "Public key copied." })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <KeyRound className="w-5 h-5" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            E2E Encryption Keys
          </h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
          Generate a WebCrypto ECDH-P256 keypair, keep the private half
          sealed in this browser with a password, and publish only the
          public half on-chain. Once both parties in an NDA have registered
          a key, the wizard offers <strong>encrypted mode</strong>: the
          protected keywords + private context never leave the browser in
          plaintext — the contract stores only a dual-envelope ciphertext.
        </p>
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
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
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
                  <Badge variant="outline">Not created</Badge>
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
                On-chain registry
              </div>
              <div className="mt-1 font-semibold">
                {registrySynced ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Synced
                  </Badge>
                ) : registryEntry ? (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    Stale key
                  </Badge>
                ) : (
                  <Badge variant="outline">Unregistered</Badge>
                )}
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
                  onClick={copyPubkey}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
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
          <CardTitle>
            {sealedPresent ? "Unlock your keystore" : "Generate a new keypair"}
          </CardTitle>
          <CardDescription>
            {sealedPresent
              ? "Enter your password to decrypt the sealed private key for this session."
              : "Pick a strong password. It never leaves this browser and cannot be recovered if you lose it."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-md p-3">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              This password protects the private key that decrypts every
              encrypted NDA addressed to you. If you forget it, you must
              generate a new keypair and re-publish it — old encrypted NDAs
              stay unreadable.
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
          <CardTitle>Publish on-chain</CardTitle>
          <CardDescription>
            Registers your public key with the contract so counterparties
            can encrypt payloads for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={handlePublish}
            disabled={busy || !localPubkey || registrySynced}
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            {registrySynced ? "Already registered" : "Register on-chain"}
          </Button>
          {registrySynced ? (
            <div className="text-xs text-slate-500">
              Registered at block time{" "}
              <code>{registryEntry?.registered_at}</code>.{" "}
              <Link
                href="/ndas/new"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Create an encrypted NDA →
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Separator />

      <div className="text-xs text-slate-500 space-y-2">
        <p>
          <strong>Threat model.</strong> Anyone can read on-chain state, so
          before v0.2.22 the free-text <code>context_description</code>
          leaked. With an encrypted NDA the on-chain payload is: (1) the
          two parties&apos; addresses, (2) a short public hint you chose,
          (3) the salted keyword hashes, (4) two AES-GCM ciphertexts. Only
          the two parties&apos; browsers hold the private keys that decrypt
          those ciphertexts. GenLayer validators fetch external URLs during
          the leak-report path but never see your plaintext keywords.
        </p>
      </div>
    </div>
  )
}
