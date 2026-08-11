"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  client,
  CONTRACT_ADDRESS,
  getAccountAddress,
  toCalldataAddress,
  walletMode,
  walletReady,
  WALLET_CHANGED_EVENT,
} from "@/lib/genlayer"
import { NDA } from "@/lib/types"
import { formatGenAmount } from "@/lib/amount"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"
import { StatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { AlertTriangle, ArrowRight, Search } from "lucide-react"

export default function ReportLandingPage() {
  const router = useRouter()
  const [ndaId, setNdaId] = useState("")
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)

  const [myNdas, setMyNdas] = useState<NDA[]>([])
  const [loading, setLoading] = useState(true)
  const [address, setAddress] = useState<string | null>(null)
  const [mode, setMode] = useState<"metamask" | "burner">("burner")

  const fetchMine = useCallback(async () => {
    if (typeof window === "undefined") {
      setLoading(false)
      return
    }
    setLoading(true)
    await walletReady
    const userAddress = getAccountAddress()
    setAddress(userAddress)
    setMode(walletMode)
    const userLower = userAddress.toLowerCase()

    // Primary path — per-user index. See ndas/page.tsx for the fallback
    // rationale (reverse-index vs full scan).
    let indexHits: NDA[] = []
    try {
      const result = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_user_ndas",
        args: [toCalldataAddress(userAddress)],
      })) as string
      if (result) indexHits = JSON.parse(result) as NDA[]
    } catch (err) {
      console.warn("get_user_ndas failed, falling back to scan", err)
    }

    // Full-scan fallback.
    let scanHits: NDA[] = []
    try {
      const statsJson = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_stats",
        args: [],
      })) as string
      const stats = statsJson ? JSON.parse(statsJson) : { total_ndas_created: "0" }
      const total = Number(stats.total_ndas_created || 0)
      if (total > 0) {
        const cap = Math.min(total, 200)
        const rows = await Promise.all(
          Array.from({ length: cap }, (_, i) => i).map(async (id) => {
            try {
              const nda = (await client.readContract({
                address: CONTRACT_ADDRESS,
                functionName: "get_nda",
                args: [BigInt(id)],
              })) as {
                id: bigint; party_a: string; party_b: string; scope: string;
                status: NDA["status"]; stake_a: bigint; stake_b: bigint;
                expiry_timestamp: bigint;
              }
              const aLower = nda.party_a.toLowerCase()
              const bLower = nda.party_b.toLowerCase()
              if (aLower !== userLower && bLower !== userLower) return null
              return {
                id: nda.id.toString(),
                party_a: nda.party_a,
                party_b: nda.party_b,
                scope: nda.scope,
                status: nda.status,
                stake_a: nda.stake_a.toString(),
                stake_b: nda.stake_b.toString(),
                expiry_timestamp: nda.expiry_timestamp.toString(),
              } as NDA
            } catch {
              return null
            }
          }),
        )
        scanHits = rows.filter((r): r is NDA => r !== null)
      }
    } catch (err) {
      console.warn("scan fallback failed", err)
    }

    const seen = new Set<string>()
    const merged: NDA[] = []
    for (const n of [...indexHits, ...scanHits]) {
      if (!seen.has(n.id)) {
        seen.add(n.id)
        merged.push(n)
      }
    }
    setMyNdas(merged)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMine()
    const onWalletChanged = () => fetchMine()
    window.addEventListener(WALLET_CHANGED_EVENT, onWalletChanged)
    return () => window.removeEventListener(WALLET_CHANGED_EVENT, onWalletChanged)
  }, [fetchMine])

  const activeMine = myNdas.filter((n) => n.status === "active")

  const handleLookup = async () => {
    setLookupError(null)
    const trimmed = ndaId.trim()
    if (!/^\d+$/.test(trimmed)) {
      setLookupError("NDA ID must be a positive integer.")
      return
    }
    setLookingUp(true)
    try {
      const nda = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_nda",
        args: [BigInt(trimmed)],
      })) as { status: string } | null
      if (!nda) {
        setLookupError("NDA not found on this contract.")
        return
      }
      if (nda.status !== "active") {
        setLookupError(
          `NDA #${trimmed} status is "${nda.status}" — only ACTIVE NDAs accept leak reports.`,
        )
        return
      }
      router.push(`/ndas/${trimmed}/report`)
    } catch (err) {
      console.error(err)
      setLookupError(
        "Could not fetch that NDA. Check the ID and that the contract is reachable.",
      )
    } finally {
      setLookingUp(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            <h1 className="text-3xl font-bold">Report an NDA Leak</h1>
          </div>
          <p className="text-slate-500 text-sm max-w-2xl">
            Anyone who is Party A or Party B of an <b>active</b> NDA can submit a
            suspect URL and the specific keywords they believe were leaked. The
            GenLayer AI Jury will fetch the URL on-chain, cross-check with the
            Wayback Machine and Google, and rule within minutes.
          </p>
        </div>
        <ConnectWalletButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="w-4 h-4" />
            Report against a specific NDA ID
          </CardTitle>
          <CardDescription>
            Paste the NDA number given to you by the other party. The ID is the
            number after <code>/ndas/</code> in the URL (e.g. 0, 1, 2, …).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={ndaId}
              onChange={(e) => setNdaId(e.target.value)}
              placeholder="NDA ID (e.g. 3)"
              inputMode="numeric"
              className="max-w-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLookup()
              }}
            />
            <Button
              onClick={handleLookup}
              disabled={lookingUp || !ndaId.trim()}
              variant="destructive"
            >
              {lookingUp ? "Checking…" : "Continue"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          {lookupError && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {lookupError}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your active NDAs</CardTitle>
          <CardDescription>
            {mode === "burner"
              ? "Showing the local burner address — connect MetaMask above to see NDAs signed with your funded wallet."
              : address
              ? `Signed in as ${address.substring(0, 6)}…${address.substring(38)}`
              : "Wallet not ready."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : activeMine.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500 space-y-3">
              <p>
                No <b>active</b> NDAs on this address yet. Only Party A or Party
                B of an active NDA can report a leak against it.
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                <Link href="/ndas/new">
                  <Button variant="outline" size="sm">
                    Create a new NDA
                  </Button>
                </Link>
                <Link href="/ndas">
                  <Button variant="ghost" size="sm">
                    View all my NDAs
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y">
              {activeMine.map((n) => {
                const counterparty =
                  address && n.party_a.toLowerCase() === address.toLowerCase()
                    ? n.party_b
                    : n.party_a
                const myStake =
                  address && n.party_a.toLowerCase() === address.toLowerCase()
                    ? n.stake_a
                    : n.stake_b
                return (
                  <li
                    key={n.id}
                    className="py-3 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">NDA #{n.id}</span>
                        <StatusBadge status={n.status} />
                      </div>
                      <div className="text-xs text-slate-500 font-mono truncate">
                        vs {counterparty.substring(0, 6)}…{counterparty.substring(38)}
                        {" · "}
                        {formatGenAmount(myStake)} GEN staked
                      </div>
                    </div>
                    <Link href={`/ndas/${n.id}/report`}>
                      <Button size="sm" variant="destructive">
                        Report Leak
                      </Button>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-slate-500 text-center">
        Reporting a false leak forfeits your 1 GEN reporter fee and drops your
        reputation score. Cross-check the suspect URL before you submit.
      </div>
    </div>
  )
}
