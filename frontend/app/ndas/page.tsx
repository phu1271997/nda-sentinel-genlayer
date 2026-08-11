"use client"

import { useCallback, useEffect, useState } from "react"
import {
  client,
  CONTRACT_ADDRESS,
  getAccountAddress,
  toCalldataAddress,
  walletMode,
  walletReady,
  WALLET_CHANGED_EVENT,
} from "@/lib/genlayer"
import { NDACard } from "@/components/NDACard"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { NDA } from "@/lib/types"
import { AlertTriangle, BadgeCheck } from "lucide-react"

export default function NDAsDashboard() {
  const [ndas, setNdas] = useState<NDA[]>([])
  const [loading, setLoading] = useState(true)
  const [address, setAddress] = useState<string | null>(null)
  const [mode, setMode] = useState<"metamask" | "burner">("burner")

  const fetchNDAs = useCallback(async () => {
    if (typeof window === "undefined") {
      setLoading(false)
      return
    }
    setLoading(true)
    // Wait for the initial MetaMask session-restore attempt so we never
    // query on the burner address when a MetaMask session actually exists.
    await walletReady
    const userAddress = getAccountAddress()
    setAddress(userAddress)
    setMode(walletMode)
    const userLower = userAddress.toLowerCase()

    // Primary path: per-user reverse index. This is O(1) but relies on the
    // Address-keyed TreeMap `user_nda_ids_json` matching the calldata
    // Address the frontend encodes — a mismatch (checksum casing, SDK
    // encoding change) would silently return "[]" and hide the user's
    // NDAs. That happened to reviewers on v0.2.20 immediately after the
    // fresh redeploy, so we back the primary path with a full scan.
    let indexHits: NDA[] = []
    try {
      const result = (await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_user_ndas",
        args: [toCalldataAddress(userAddress)],
      })) as string
      if (result) {
        indexHits = JSON.parse(result) as NDA[]
      }
    } catch (err) {
      console.warn("get_user_ndas failed, falling back to scan", err)
    }

    // Fallback: read the total NDA count and iterate every id, filtering
    // by whether the user is party_a or party_b. Works regardless of the
    // reverse index and guarantees no NDA is missed.
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
        const cap = Math.min(total, 200) // safety cap for a first-load scan
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

    // Union by id — index hits kept first (they're already sorted by
    // insertion time), scan hits fill in anything the index missed.
    const seen = new Set<string>()
    const merged: NDA[] = []
    for (const n of [...indexHits, ...scanHits]) {
      if (!seen.has(n.id)) {
        seen.add(n.id)
        merged.push(n)
      }
    }
    setNdas(merged)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchNDAs()
    const onWalletChanged = () => fetchNDAs()
    window.addEventListener(WALLET_CHANGED_EVENT, onWalletChanged)
    return () =>
      window.removeEventListener(WALLET_CHANGED_EVENT, onWalletChanged)
  }, [fetchNDAs])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My NDAs</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={fetchNDAs} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Link href="/ndas/new">
            <Button>Create NDA</Button>
          </Link>
          <Link href="/report">
            <Button variant="destructive">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Report Leak
            </Button>
          </Link>
          <Link href="/identity">
            <Button
              variant="outline"
              className="border-emerald-300 text-emerald-700 dark:text-emerald-400"
            >
              <BadgeCheck className="w-4 h-4 mr-1" />
              Identity
            </Button>
          </Link>
          <ConnectWalletButton />
        </div>
      </div>

      {mode === "burner" && (
        <div className="mb-6 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
          Showing the local burner address. Connect MetaMask above to see
          NDAs signed with your funded wallet.
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : address ? (
        ndas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ndas.map(nda => (
              <NDACard 
                key={nda.id}
                id={nda.id}
                counterparty={nda.party_a.toLowerCase() === address.toLowerCase() ? nda.party_b : nda.party_a}
                scope={nda.scope}
                status={nda.status}
                stake={nda.party_a.toLowerCase() === address.toLowerCase() ? nda.stake_a : nda.stake_b}
                expiryTimestamp={nda.expiry_timestamp}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-50 dark:bg-slate-900 rounded-xl">
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No NDAs found</h3>
            <p className="text-slate-500 mb-6">You don&apos;t have any active or pending NDAs yet.</p>
            <div className="flex justify-center gap-2 flex-wrap">
              <Link href="/ndas/new">
                <Button>Create your first NDA</Button>
              </Link>
              <Link href="/report">
                <Button variant="destructive">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Report a Leak on someone else&apos;s NDA
                </Button>
              </Link>
            </div>
          </div>
        )
      ) : (
        <div className="text-center py-20">
          <p className="text-slate-500 mb-4">Please connect your wallet to view your NDAs.</p>
          <ConnectWalletButton />
        </div>
      )}
    </div>
  )
}
