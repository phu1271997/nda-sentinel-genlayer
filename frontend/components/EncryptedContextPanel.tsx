"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Lock, Unlock, KeyRound, AlertTriangle, RefreshCcw } from "lucide-react"
import {
  activeAddress,
  assertWritable,
  client,
  CONTRACT_ADDRESS,
  ensureCorrectChainBeforeWrite,
  explorerTxUrl,
  WalletNotReadyError,
} from "@/lib/genlayer"
import { decryptFromEnvelope, encryptToRecipient } from "@/lib/e2ee"
import { getUnlockedKeypair } from "@/lib/keyring"
import { parseContractError } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface EncryptedContextPayload {
  is_encrypted: boolean
  ciphertext_a: string
  ciphertext_b: string
  envelope_meta_json: string
}

interface Props {
  ndaId: string
  partyA: string
  partyB: string
}

export function EncryptedContextPanel({ ndaId, partyA, partyB }: Props) {
  const [state, setState] = useState<EncryptedContextPayload | null>(null)
  const [decrypted, setDecrypted] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [decrypting, setDecrypting] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const raw = (await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_encrypted_context",
          args: [BigInt(ndaId)],
        })) as string
        if (cancelled) return
        const parsed = JSON.parse(raw) as EncryptedContextPayload
        setState(parsed)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [ndaId])

  const isEncrypted = !!state?.is_encrypted
  if (loading || !isEncrypted) return null

  const meta = (() => {
    try {
      return JSON.parse(state?.envelope_meta_json || "{}") as {
        algo?: string
        v?: number
        sender_pubkey_fingerprint?: string
        recipient_pubkey_fingerprint?: string
      }
    } catch {
      return {}
    }
  })()

  const me = activeAddress?.toLowerCase()
  const isPartyA = me === partyA.toLowerCase()
  const isPartyB = me === partyB.toLowerCase()
  const envelope = isPartyA
    ? state?.ciphertext_a
    : isPartyB
      ? state?.ciphertext_b
      : ""

  const rotateSessionKey = async () => {
    setError(null)
    setRotating(true)
    setTxHash(null)
    try {
      if (!decrypted) throw new Error("Decrypt first — rotation encrypts the plaintext under a new session key.")
      const kp = getUnlockedKeypair(activeAddress)
      if (!kp) throw new Error("Unlock your keystore at /keys.")
      // Fetch fresh pubkey for both parties.
      const [keyARaw, keyBRaw] = await Promise.all([
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_encryption_key",
          args: [partyA],
        }) as Promise<string>,
        client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_encryption_key",
          args: [partyB],
        }) as Promise<string>,
      ])
      const kA = JSON.parse(keyARaw) as { pubkey: string; algo: string }
      const kB = JSON.parse(keyBRaw) as { pubkey: string; algo: string }
      if (!kA.pubkey || !kB.pubkey) throw new Error("Both parties must have registered pubkeys.")
      const [newA, newB] = await Promise.all([
        encryptToRecipient(kA.pubkey, decrypted),
        encryptToRecipient(kB.pubkey, decrypted),
      ])
      const meta = JSON.stringify({
        algo: "ecdh-p256+hkdf-sha256+aes-256-gcm",
        v: 1,
        rotated_at: Date.now(),
        rotated_by: activeAddress.toLowerCase(),
      })
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = (await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "rotate_nda_session_key",
        args: [BigInt(ndaId), newA, newB, meta],
        value: BigInt(0),
      })) as `0x${string}`
      setTxHash(hash)
      await client.waitForTransactionReceipt({
        hash: hash as unknown as `0x${string}` & { length: 66 },
        status: "ACCEPTED" as never,
        retries: 120,
        interval: 3000,
      })
    } catch (err) {
      if (err instanceof WalletNotReadyError) setError(err.message)
      else setError(parseContractError(err))
    } finally {
      setRotating(false)
    }
  }

  const handleDecrypt = async () => {
    setError(null)
    setDecrypting(true)
    try {
      const kp = getUnlockedKeypair(activeAddress)
      if (!kp) {
        setError("Unlock your keystore at /keys first.")
        return
      }
      if (!envelope) {
        setError("You are not a party to this NDA; no envelope addressed to you.")
        return
      }
      const pt = await decryptFromEnvelope(envelope, kp.privateKeyPkcs8B64)
      setDecrypted(pt)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDecrypting(false)
    }
  }

  return (
    <Card className="border-emerald-300/70 bg-emerald-50/50 dark:bg-emerald-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <CardTitle className="text-emerald-800 dark:text-emerald-200">
            Encrypted vault
          </CardTitle>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ml-auto">
            {meta.algo ?? "ecdh-p256+aes-gcm"}
          </Badge>
        </div>
        <CardDescription>
          Only the two parties&apos; browsers hold the private keys that decrypt
          the on-chain envelopes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isPartyA && !isPartyB ? (
          <div className="text-sm flex items-start gap-2 rounded-md bg-slate-100 dark:bg-slate-900 p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-slate-500" />
            <span>You are not a party to this NDA. No envelope is addressed to you.</span>
          </div>
        ) : decrypted !== null ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
              <Unlock className="w-4 h-4" /> Decrypted locally
            </div>
            <pre className="text-xs bg-slate-100 dark:bg-slate-900 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(decrypted), null, 2)
                } catch {
                  return decrypted
                }
              })()}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={rotateSessionKey}
                disabled={rotating}
                className="text-blue-700 dark:text-blue-300"
              >
                <RefreshCcw className={`w-4 h-4 mr-1 ${rotating ? "animate-spin" : ""}`} />
                {rotating ? "Rotating…" : "Rotate session key"}
              </Button>
            </div>
            {txHash ? (
              <p className="text-xs text-slate-500">
                Rotation tx:{" "}
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
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 font-mono break-all bg-slate-100 dark:bg-slate-900 rounded p-2">
              envelope ({envelope?.length ?? 0} chars, base64):{" "}
              {envelope ? `${envelope.slice(0, 24)}…${envelope.slice(-16)}` : "—"}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleDecrypt}
                disabled={decrypting || !envelope}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Unlock className="w-4 h-4 mr-2" />
                {decrypting ? "Decrypting…" : "Decrypt with my key"}
              </Button>
              <Link
                href="/keys"
                className="text-sm text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1 hover:underline px-3 py-2"
              >
                <KeyRound className="w-4 h-4" /> Manage keys
              </Link>
            </div>
          </div>
        )}
        {error ? (
          <div className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 rounded-md p-3">
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
