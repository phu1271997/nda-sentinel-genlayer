"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  assertWritable,
  client,
  CONTRACT_ADDRESS,
  ensureCorrectChainBeforeWrite,
  explorerTxUrl,
  getAccountAddress,
  toCalldataAddress,
  walletReady,
  WALLET_CHANGED_EVENT,
  WalletNotReadyError,
} from "@/lib/genlayer"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"
import { EventTimeline } from "@/components/EventTimeline"
import { LeakHistoryPanel } from "@/components/LeakHistoryPanel"
import { ReputationBadge } from "@/components/ReputationBadge"
import { StatusBadge } from "@/components/StatusBadge"
import { NDALifecycleStepper } from "@/components/NDALifecycleStepper"
import { VerdictPanel } from "@/components/VerdictPanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { NDADetail, Verdict } from "@/lib/types"
import { formatGenAmount } from "@/lib/amount"
import { parseContractError } from "@/lib/utils"
import { format } from "date-fns"
import Link from "next/link"

export default function NDADetailPage() {
  const { ndaId } = useParams()
  const [nda, setNda] = useState<NDADetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [address, setAddress] = useState<string | null>(null)
  const [isActivating, setIsActivating] = useState(false)
  const [isExpiring, setIsExpiring] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isAppealing, setIsAppealing] = useState(false)
  const [isClaimingReward, setIsClaimingReward] = useState(false)
  // v0.2.20 — structured appeal fields (contract enforces the enum and
  // the PRIOR_DISCLOSURE timestamp gate; free-form prose is only allowed
  // as advisory context_notes).
  const [appealGround, setAppealGround] = useState<
    "PRIOR_DISCLOSURE" | "ATTRIBUTION_ERROR" | "KEYWORD_MISMATCH"
  >("PRIOR_DISCLOSURE")
  const [appealEvidenceUrl, setAppealEvidenceUrl] = useState("")
  const [appealEvidenceDate, setAppealEvidenceDate] = useState("")
  const [counterEvidence, setCounterEvidence] = useState("")
  const [withdrawable, setWithdrawable] = useState<string>("0")
  const [currentTimeMs, setCurrentTimeMs] = useState<number | null>(null)
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)

  const fetchNDA = useCallback(async (userAddress?: string) => {
    try {
      const result = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_nda",
        args: [BigInt(ndaId as string)]
      }) as {
        id: bigint; party_a: string; party_b: string; scope: string;
        context_description: string; status: NDADetail["status"];
        stake_a: bigint; stake_b: bigint; expiry_timestamp: bigint;
        created_at: bigint; activated_at: bigint; keyword_hash_count: bigint;
        suspect_url: string; verdict_json: string; violator: string;
        slashed_amount: bigint; reporter: string; appeal_deadline: bigint;
      };
      
      if (result) {
        setNda({
          id: result.id.toString(),
          party_a: result.party_a,
          party_b: result.party_b,
          scope: result.scope,
          context_description: result.context_description,
          status: result.status,
          stake_a: result.stake_a.toString(),
          stake_b: result.stake_b.toString(),
          expiry_timestamp: result.expiry_timestamp.toString(),
          created_at: result.created_at.toString(),
          activated_at: result.activated_at.toString(),
          keyword_hash_count: result.keyword_hash_count.toString(),
          suspect_url: result.suspect_url,
          verdict_json: result.verdict_json,
          violator: result.violator,
          slashed_amount: result.slashed_amount.toString(),
          reporter: result.reporter,
          appeal_deadline: result.appeal_deadline.toString()
        });
      }

      if (userAddress) {
        const bal = await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_withdrawable",
          args: [toCalldataAddress(userAddress)]
        }) as bigint;
        setWithdrawable(bal.toString());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [ndaId])

  useEffect(() => {
    const init = async () => {
      if (typeof window !== "undefined") {
        await walletReady;
      }
      const userAddr = typeof window !== "undefined" ? getAccountAddress() : undefined;
      if (userAddr) setAddress(userAddr);
      await fetchNDA(userAddr);
    }
    init();
    const onWalletChange = () => {
      const newAddr = getAccountAddress();
      setAddress(newAddr);
      fetchNDA(newAddr);
    };
    if (typeof window !== "undefined") {
      window.addEventListener(WALLET_CHANGED_EVENT, onWalletChange);
      return () =>
        window.removeEventListener(WALLET_CHANGED_EVENT, onWalletChange);
    }
  }, [fetchNDA])

  useEffect(() => {
    const refreshClock = () => setCurrentTimeMs(Date.now())
    const initialTimer = window.setTimeout(refreshClock, 0)
    const interval = window.setInterval(refreshClock, 30_000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
    }
  }, [])

  type WriteHash = Awaited<ReturnType<typeof client.writeContract>>;
  const runWrite = async (
    fn: () => Promise<WriteHash>,
    opts?: { nondet?: boolean },
  ): Promise<WriteHash | null> => {
    await assertWritable();
    await ensureCorrectChainBeforeWrite();
    const hash = await fn();
    setLastTxHash(hash);
    // ACCEPTED = leader executed + validators agreed. FINALIZED would wait
    // for the full appeal window to close (~5+ min on studionet) which is
    // not what a UI should block on. Nondet-heavy writes (appeal) still
    // need extra time for the LLM/web fetch inside consensus, so bump the
    // poller ceiling from the SDK default 150 s to 10 min.
    const wait = opts?.nondet
      ? { hash, status: "ACCEPTED" as never, retries: 200, interval: 3000 }
      : { hash, status: "ACCEPTED" as never };
    await client.waitForTransactionReceipt(wait);
    return hash;
  };

  const handleActivate = async () => {
    if (!nda || !address) return;
    setIsActivating(true);
    try {
      await runWrite(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "activate_nda",
          args: [BigInt(nda.id)],
          value: BigInt(nda.stake_a),
        }),
      );
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      alert("Error activating NDA: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsActivating(false);
    }
  }

  const handleCancelPending = async () => {
    if (!nda || !address) return;
    setIsCancelling(true);
    try {
      await runWrite(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "cancel_pending_nda",
          args: [BigInt(nda.id)],
          value: BigInt(0),
        }),
      );
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      alert(parseContractError(err));
    } finally {
      setIsCancelling(false);
    }
  }

  const handleExpire = async () => {
    if (!nda || !address) return;
    setIsExpiring(true);
    try {
      await runWrite(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "expire_and_withdraw",
          args: [BigInt(nda.id)],
          value: BigInt(0),
        }),
      );
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      alert("Error expiring NDA: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExpiring(false);
    }
  }

  const handleWithdraw = async () => {
    if (!address) return;
    try {
      await runWrite(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "withdraw",
          args: [],
          value: BigInt(0),
        }),
      );
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      alert("Error withdrawing: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  const handleAppeal = async () => {
    if (!nda || !address) return;
    const url = appealEvidenceUrl.trim();
    if (!/^https?:\/\/.{4,}/.test(url)) {
      alert("Evidence URL must be a valid http:// or https:// URL");
      return;
    }
    let evidenceTs = 0n;
    if (appealGround === "PRIOR_DISCLOSURE") {
      if (!appealEvidenceDate) {
        alert("PRIOR_DISCLOSURE requires an evidence publication date");
        return;
      }
      const ms = Date.parse(appealEvidenceDate);
      if (!Number.isFinite(ms) || ms <= 0) {
        alert("Invalid evidence date");
        return;
      }
      const seconds = BigInt(Math.floor(ms / 1000));
      if (seconds >= BigInt(nda.created_at)) {
        alert(
          "PRIOR_DISCLOSURE evidence date must be strictly BEFORE the NDA's creation date",
        );
        return;
      }
      evidenceTs = seconds;
    }
    setIsAppealing(true);
    try {
      const appealFee = BigInt(nda.slashed_amount) / 10n;
      await runWrite(
        () =>
          client.writeContract({
            address: CONTRACT_ADDRESS,
            functionName: "appeal",
            args: [
              BigInt(nda.id),
              appealGround,
              url,
              evidenceTs,
              counterEvidence.trim(),
            ],
            value: appealFee,
          }),
        { nondet: true },
      );
      setCounterEvidence("");
      setAppealEvidenceUrl("");
      setAppealEvidenceDate("");
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      if (err instanceof WalletNotReadyError) {
        alert(err.message);
      } else {
        alert(parseContractError(err));
      }
    } finally {
      setIsAppealing(false);
    }
  }

  const handleClaimReward = async () => {
    if (!nda || !address) return;
    setIsClaimingReward(true);
    try {
      // finalize_verdict is the anyone-in-NDA anyone-after-rescue path added
      // in v0.2.18. claim_reporter_reward is kept as its alias for callers
      // built against the old ABI.
      await runWrite(() =>
        client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "finalize_verdict",
          args: [BigInt(nda.id)],
          value: 0n,
        }),
      );
      await fetchNDA(address);
    } catch (err) {
      console.error(err);
      if (err instanceof WalletNotReadyError) {
        alert(err.message);
      } else {
        alert(parseContractError(err));
      }
    } finally {
      setIsClaimingReward(false);
    }
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Loading NDA details...</div>
  }

  if (!nda) {
    return <div className="container mx-auto px-4 py-8">NDA not found</div>
  }

  const isPartyA = address?.toLowerCase() === nda.party_a.toLowerCase();
  const isPartyB = address?.toLowerCase() === nda.party_b.toLowerCase();
  const expiryDate = new Date(parseInt(nda.expiry_timestamp) * 1000);
  const isExpired = expiryDate < new Date();
  let parsedVerdict: Verdict | null = null;
  try {
    parsedVerdict = nda.verdict_json ? JSON.parse(nda.verdict_json) : null;
  } catch {
    parsedVerdict = null;
  }
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const isViolator = !!address && nda.violator.toLowerCase() === address.toLowerCase();
  const isReporter = !!address && nda.reporter.toLowerCase() === address.toLowerCase();
  const appealDeadlineMs = Number(nda.appeal_deadline) * 1000;
  const appealOpen = currentTimeMs !== null && nda.status === "leaked" && nda.violator.toLowerCase() !== zeroAddress && currentTimeMs < appealDeadlineMs;
  // finalize_verdict is callable by reporter, either party of the NDA, or
  // anyone after the rescue window — the contract enforces the exact auth
  // rule; the UI just surfaces the button to anyone who could plausibly call.
  const rewardClaimable = currentTimeMs !== null && nda.status === "leaked" && (isReporter || isPartyA || isPartyB) && appealDeadlineMs > 0 && currentTimeMs >= appealDeadlineMs;
  // v0.2.20.2 — Party A can cancel a pending NDA and reclaim their stake
  // after 7 days if Party B never activates. Contract: cancel_pending_nda.
  const cancelDeadlineMs = (parseInt(nda.created_at) + 7 * 24 * 60 * 60) * 1000;
  const cancelPendingAvailable = nda.status === "pending" && isPartyA && currentTimeMs !== null && currentTimeMs >= cancelDeadlineMs;
  const cancelPendingCountdownDays = nda.status === "pending" && isPartyA && currentTimeMs !== null && currentTimeMs < cancelDeadlineMs
    ? Math.ceil((cancelDeadlineMs - currentTimeMs) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">NDA #{nda.id}</h1>
            <StatusBadge status={nda.status} />
          </div>
          <p className="text-slate-500 text-sm">
            Created on {format(new Date(parseInt(nda.created_at) * 1000), "PPP")}
          </p>
        </div>
        <ConnectWalletButton />
      </div>

      <NDALifecycleStepper status={nda.status} />

      {lastTxHash && (
        <div className="rounded border bg-slate-50 dark:bg-slate-900/40 text-xs px-3 py-2 flex items-center justify-between">
          <span className="text-slate-500">Last transaction:</span>
          <a
            href={explorerTxUrl(lastTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all ml-2"
          >
            {lastTxHash.substring(0, 10)}…{lastTxHash.substring(60)}
          </a>
        </div>
      )}

      {BigInt(withdrawable) > BigInt(0) && (
        <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50">
          <CardContent className="flex justify-between items-center p-6">
            <div>
              <h3 className="font-bold text-emerald-800 dark:text-emerald-400">Available to Withdraw</h3>
              <p className="text-2xl font-mono">{formatGenAmount(withdrawable)} GEN</p>
            </div>
            <Button onClick={handleWithdraw} className="bg-emerald-600 hover:bg-emerald-700">
              Withdraw
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-500 uppercase">Party A (Creator)</p>
              <ReputationBadge address={nda.party_a} />
            </div>
            <p className="font-mono text-sm break-all">{nda.party_a}</p>
            <p className="text-sm">Stake: {formatGenAmount(nda.stake_a)} GEN</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-500 uppercase">Party B (Counterparty)</p>
              <ReputationBadge address={nda.party_b} />
            </div>
            <p className="font-mono text-sm break-all">{nda.party_b}</p>
            <p className="text-sm">Stake: {formatGenAmount(nda.stake_b)} GEN</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Scope</p>
            <p className="capitalize font-medium">{nda.scope.replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Public Context</p>
            <p className="text-slate-700 dark:text-slate-300">{nda.context_description}</p>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Protected Keywords</p>
              <p className="font-medium">{nda.keyword_hash_count} Hashes</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Expiry</p>
              <p className="font-medium">{format(expiryDate, "PPP")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {nda.status === "leaked" && parsedVerdict && (
        <VerdictPanel verdict={parsedVerdict} />
      )}

      {/* Show past leak reports for NDAs still in non-leaked state
          (no_violation / inconclusive verdicts don't persist verdict_json
          on-chain — the record lives in the event log instead). */}
      {nda.status !== "leaked" && <LeakHistoryPanel ndaId={nda.id} />}

      {appealOpen && isViolator && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="font-bold text-amber-900 dark:text-amber-300">
                Appeal this verdict (contract-verifiable)
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-400">
                Submit before {format(new Date(appealDeadlineMs), "PPp")} with a{" "}
                {formatGenAmount(BigInt(nda.slashed_amount) / 10n)} GEN appeal
                stake. Every appeal declares one of three enum grounds and cites
                an <b>evidence URL the appellate jury fetches on-chain</b>.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Appeal ground</label>
              <select
                value={appealGround}
                onChange={(e) =>
                  setAppealGround(
                    e.target.value as
                      | "PRIOR_DISCLOSURE"
                      | "ATTRIBUTION_ERROR"
                      | "KEYWORD_MISMATCH",
                  )
                }
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="PRIOR_DISCLOSURE">
                  PRIOR_DISCLOSURE — the info was already public before the NDA
                </option>
                <option value="ATTRIBUTION_ERROR">
                  ATTRIBUTION_ERROR — I am not the author of the suspect page
                </option>
                <option value="KEYWORD_MISMATCH">
                  KEYWORD_MISMATCH — flagged wording is generic, not protected
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Evidence URL</label>
              <input
                type="url"
                value={appealEvidenceUrl}
                onChange={(e) => setAppealEvidenceUrl(e.target.value)}
                placeholder="https://web.archive.org/web/2025.../..."
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-500">
                Validators will fetch this URL via <code>gl.nondet.web.render</code> during
                consensus. Prefer Wayback Machine snapshots for prior-disclosure claims.
              </p>
            </div>
            {appealGround === "PRIOR_DISCLOSURE" && (
              <div className="space-y-2">
                <label className="text-sm font-semibold">
                  Evidence publication date{" "}
                  <span className="text-rose-600">(must be strictly before NDA creation)</span>
                </label>
                <input
                  type="date"
                  value={appealEvidenceDate}
                  onChange={(e) => setAppealEvidenceDate(e.target.value)}
                  max={format(
                    new Date((parseInt(nda.created_at) - 86400) * 1000),
                    "yyyy-MM-dd",
                  )}
                  className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
                <p className="text-xs text-slate-500">
                  NDA was created on{" "}
                  {format(new Date(parseInt(nda.created_at) * 1000), "PPP")}. The
                  contract itself rejects any date &ge; that day.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold">
                Context notes <span className="text-slate-500 font-normal">(advisory, optional)</span>
              </label>
              <Textarea
                value={counterEvidence}
                onChange={(event) => setCounterEvidence(event.target.value)}
                maxLength={2000}
                placeholder="Short note the appellate jury reads alongside the evidence URL. Cannot be the sole basis of an overturn."
              />
            </div>
            <Button
              onClick={handleAppeal}
              disabled={isAppealing || !appealEvidenceUrl.trim()}
            >
              {isAppealing ? "Submitting appeal..." : "Submit Appeal"}
            </Button>
          </CardContent>
        </Card>
      )}

      {rewardClaimable && (
        <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-emerald-900 dark:text-emerald-300">Verdict ready to finalize</h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-400">
                Appeal window closed. Anyone in the NDA can release the escrow — the
                reporter gets 80 %, the non-violator 17 %, treasury 3 %.
              </p>
            </div>
            <Button onClick={handleClaimReward} disabled={isClaimingReward} className="bg-emerald-600 hover:bg-emerald-700">
              {isClaimingReward
                ? "Finalizing..."
                : isReporter
                ? "Claim Reward"
                : "Finalize Verdict"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ACTION AREA */}
      <div className="pt-4 flex flex-col items-center gap-4">
        <div className="flex justify-center gap-4 flex-wrap">
          {nda.status === "pending" && isPartyB && (
            <Button size="lg" onClick={handleActivate} disabled={isActivating}>
              {isActivating ? "Activating..." : `Activate & Stake ${formatGenAmount(nda.stake_a)} GEN`}
            </Button>
          )}

          {nda.status === "active" && (isPartyA || isPartyB) && !isExpired && (
            <Link href={`/ndas/${nda.id}/report`}>
              <Button size="lg" variant="destructive">
                Report Leak
              </Button>
            </Link>
          )}

          {nda.status === "active" && isExpired && (isPartyA || isPartyB) && (
            <Button size="lg" onClick={handleExpire} disabled={isExpiring}>
              {isExpiring ? "Processing..." : "Expire & Withdraw Stake"}
            </Button>
          )}

          {cancelPendingAvailable && (
            <Button
              size="lg"
              variant="outline"
              onClick={handleCancelPending}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel & Refund Stake"}
            </Button>
          )}
        </div>

        {cancelPendingCountdownDays !== null && (
          <p className="text-xs text-slate-500 text-center max-w-lg">
            Party B has not activated yet. As Party A, you can cancel this NDA
            and reclaim your stake in{" "}
            <b>{cancelPendingCountdownDays} day{cancelPendingCountdownDays === 1 ? "" : "s"}</b>{" "}
            if activation still has not happened by then.
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">On-chain event log</h3>
            <p className="text-xs text-slate-500">
              Every state transition emits an event via <code>_emit()</code>.
              Read from the contract with <code>get_events_for_nda</code>.
            </p>
          </div>
          <EventTimeline ndaId={nda.id} />
        </CardContent>
      </Card>
    </div>
  )
}
