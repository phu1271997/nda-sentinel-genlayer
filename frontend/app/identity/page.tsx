"use client"

import { useCallback, useEffect, useState } from "react"
import {
  assertWritable,
  client,
  CONTRACT_ADDRESS,
  ensureCorrectChainBeforeWrite,
  explorerTxUrl,
  getAccountAddress,
  toCalldataAddress,
  walletMode,
  walletReady,
  WALLET_CHANGED_EVENT,
  WalletNotReadyError,
} from "@/lib/genlayer"
import { parseContractError } from "@/lib/utils"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BadgeCheck, ShieldAlert } from "lucide-react"
import Link from "next/link"

interface Identity {
  handle: string
  proof_url: string
  verified_at: string
}

export default function IdentityPage() {
  const [address, setAddress] = useState<string | null>(null)
  const [mode, setMode] = useState<"metamask" | "burner">("burner")
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [handle, setHandle] = useState("")
  const [proofUrl, setProofUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return
    await walletReady
    const addr = getAccountAddress()
    setAddress(addr)
    setMode(walletMode)
    try {
      const raw = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_publisher_identity",
        args: [toCalldataAddress(addr)],
      })) as string
      setIdentity(JSON.parse(raw) as Identity)
    } catch (err) {
      console.error("Failed to fetch identity", err)
      setIdentity(null)
    }
  }, [])

  useEffect(() => {
    refresh()
    const onWalletChanged = () => refresh()
    window.addEventListener(WALLET_CHANGED_EVENT, onWalletChanged)
    return () =>
      window.removeEventListener(WALLET_CHANGED_EVENT, onWalletChanged)
  }, [refresh])

  const submit = async () => {
    if (!handle.trim() || !proofUrl.trim()) return
    const url = proofUrl.trim()
    if (!/^https?:\/\/.{4,}/.test(url)) {
      alert("Proof URL must be a valid http:// or https:// URL")
      return
    }
    setIsSubmitting(true)
    try {
      await assertWritable()
      await ensureCorrectChainBeforeWrite()
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "register_publisher_identity",
        args: [handle.trim(), url],
        value: 0n,
      })
      setLastTxHash(hash)
      // Nondet-heavy write (validators fetch proof_url + LLM verify).
      await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED" as never,
        retries: 200,
        interval: 3000,
      })
      setHandle("")
      setProofUrl("")
      await refresh()
    } catch (err) {
      console.error(err)
      if (err instanceof WalletNotReadyError) {
        alert(err.message)
      } else {
        alert(parseContractError(err))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const verified = identity && identity.handle !== ""

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BadgeCheck className="w-6 h-6 text-emerald-600" />
            <h1 className="text-3xl font-bold">Publisher Identity</h1>
          </div>
          <p className="text-slate-500 text-sm max-w-2xl">
            Prove that a public handle (Twitter, GitHub, blog domain, …) is
            controlled by this on-chain address. When someone reports a leak
            later, the AI Jury reads registered handles to attribute the
            suspect page — closing the loophole that free-text{" "}
            <code>responsible_party</code> guesses left open.
          </p>
        </div>
        <ConnectWalletButton />
      </div>

      {mode === "burner" && (
        <div className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5" />
          <span>
            You&apos;re on the local burner. Connect MetaMask above to register
            identity for your funded address.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current status</CardTitle>
          <CardDescription>
            {address ? (
              <span className="font-mono text-xs break-all">{address}</span>
            ) : (
              "Wallet not ready."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verified ? (
            <div className="rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BadgeCheck className="w-5 h-5 text-emerald-600" />
                <b className="text-emerald-900 dark:text-emerald-200">
                  Verified
                </b>
              </div>
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-slate-500">Handle:</span>{" "}
                  <span className="font-mono">{identity!.handle}</span>
                </div>
                <div>
                  <span className="text-slate-500">Proof URL:</span>{" "}
                  <a
                    href={identity!.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline break-all"
                  >
                    {identity!.proof_url}
                  </a>
                </div>
                <div>
                  <span className="text-slate-500">Verified at:</span>{" "}
                  {new Date(
                    parseInt(identity!.verified_at) * 1000,
                  ).toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No verified identity for this address yet. Registering one
              strengthens attribution in every future leak report against you or
              in your favour.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {verified ? "Re-register identity" : "Register identity"}
          </CardTitle>
          <CardDescription>
            The proof URL must be a public page you control that contains BOTH
            the handle string AND your address <code>{address ?? "…"}</code>.
            Validators fetch the URL and an AI checks the two facts before
            writing the mapping on-chain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Handle (Twitter @, GitHub username, blog domain, …)
            </label>
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@alice_public"
              maxLength={64}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Proof URL (must contain both your handle and your address)
            </label>
            <Input
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://gist.github.com/alice_public/…"
            />
            <p className="text-xs text-slate-500">
              Fast path: publish a public gist / tweet / blog post that says{" "}
              <code>@yourhandle owns {address ?? "0x…"}</code> and paste its URL
              here.
            </p>
          </div>
          <Button
            onClick={submit}
            disabled={isSubmitting || !handle.trim() || !proofUrl.trim()}
          >
            {isSubmitting
              ? "Verifying on-chain (30 s – 3 min)…"
              : "Register identity"}
          </Button>
          {lastTxHash && (
            <div className="text-xs text-slate-500">
              Tx:{" "}
              <a
                href={explorerTxUrl(lastTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
              >
                {lastTxHash.substring(0, 10)}…{lastTxHash.substring(60)}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-slate-500 text-center">
        <Link href="/" className="underline">
          ← Home
        </Link>
      </div>
    </div>
  )
}
