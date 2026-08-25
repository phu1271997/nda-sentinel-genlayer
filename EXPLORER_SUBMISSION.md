# GENLAYER PROJECT EXPLORER — SUBMISSION DRAFT

**Project:** NDA Sentinel · **Prepared:** 2026-08-25 · **Status: READY**

Seed complete on studionet. NDA #3 = violation_confirmed + appeal_upheld (Record A + C); NDA #4 = no_violation (Record B). All three records readable in incognito **without a wallet** at https://nda-sentinel.vercel.app.

---

## 01 — IDENTITY

### Project name
NDA Sentinel

### Primary category
**Dispute Resolution**

Chosen because the contract's core loop is a two-tier adjudication panel (first jury on the leak, appellate jury on the appeal) that produces a verdict and slashes escrow. Not chosen `AI & Agents` — every catalog listing is AI-powered, that label would not distinguish this listing. Not chosen `Governance` — no proposal/voting mechanism.

### Category tag 1
**Evidence Assessment**

`report_leak` calls `gl.eq_principle.prompt_comparative` with a `leader_fn` that fetches three sources — the suspect URL, the Wayback Machine snapshot, and a Google search of the leaked term — via `gl.nondet.web.render`, then instructs validators to weigh them (`sources_confirming`) before returning a JSON verdict.

### Category tag 2
**Appeal Review**

`appeal(nda_id, appeal_ground, evidence_url, evidence_timestamp, context_notes)` opens a second consensus round. The appellate `leader_fn` fetches the appellant's cited `evidence_url` inside its own `prompt_comparative` closure, and the ground-specific prompt returns `verdict ∈ {overturned, upheld, inconclusive}` plus `evidence_supports_ground`. `PRIOR_DISCLOSURE` timestamp is gated by the contract before the LLM is even called.

### Rejected tags (justification)

- **Jury Selection** — validator selection is GenLayer's job, not the app's. Contract never chooses jurors.
- **License Claims** — no license terms in scope.
- **Moderation Appeals** — protocol is bilateral NDA enforcement, not takedown/moderation.
- **Escrow Claims** — closer, but the escrow release is triggered by an AI verdict rather than by a bilateral claim on a deliverable.

### Logo
- `frontend/public/logo-1024.png` — 1024×1024, 1.13 MB
- `frontend/public/logo-512.png` — 512×512, 314 KB (safer if the Portal uploader is picky)
- `frontend/public/logo.svg` — vector source for future edits

Upload the 1024 PNG to the Portal.

---

## 02 — PROJECT SUMMARY

### One-liner (153 chars / cap 180)

NDA Sentinel adjudicates leak accusations with an on-chain AI Jury that reads the suspect URL itself and slashes escrow when a verdict comes back guilty.

### Description (974 chars / cap 1000)

NDA Sentinel is a trustless NDA enforcement dApp. Two parties commit sha256(keyword+salt) hashes on-chain and stake GEN into escrow. When one leaks the protected information, the other reports a suspect URL and reveals the plaintext keyword.

The contract fires an AI Jury inside GenLayer consensus: validators call gl.nondet.web.render on the suspect URL plus a Wayback snapshot and a Google search of the leaked term, then reach prompt_comparative agreement on verdict, responsible_party, and prior_disclosure_found. A confirmed violation slashes the stake — 80% reporter reward, 17% non-violator compensation, 3% treasury.

The violator has a 7-day appeal window. Every appeal declares one enum ground (PRIOR_DISCLOSURE, ATTRIBUTION_ERROR, KEYWORD_MISMATCH) and cites an evidence URL the appellate jury also fetches on-chain. For PRIOR_DISCLOSURE the contract itself rejects any evidence_timestamp not strictly before NDA creation, so the LLM never reasons about dates.

---

## 03 — HOW TO TRY IT

### Prerequisites

- MetaMask installed. First visit will prompt `wallet_switchEthereumChain` / `wallet_addEthereumChain` for the GenLayer Studio Network (chain id 61999 / 0xF1EF, RPC https://studio.genlayer.com/api). Accept.
- Studio account with GEN. Open https://studio.genlayer.com → Accounts panel → transfer ~5 GEN from a pre-funded account to your MetaMask address. No public faucet exists on studionet.
- No wallet needed for read-only browsing (dashboard, verdict panel, event timeline).

### Step 1 — Browse the seeded NDAs (no wallet needed)

Open the app and paste `/ndas/3` and `/ndas/4` after the URL — no wallet, no keys required, the reads are public. **NDA #3** shows the violation-confirmed path: red verdict panel with the AI Jury's reasoning, a 6-event timeline ending in `appeal_upheld`, and full escrow accounting. **NDA #4** shows the no-violation path: status stays Active, a green "Past leak reports" panel surfaces the AI Jury's `no_violation` verdict recorded in the event log.

### Step 2 — Create your own NDA

Click "Create NDA". Enter a counterparty address (second MetaMask account, or a friend). Pick a scope (e.g. `trade_secret`), a public context, and an expiry ≥ tomorrow. List one or more protected keywords — they are hashed with a random salt in the browser and never leave your device. Download the Secret Vault (encrypted JSON) and stake ≥1 GEN. The tx runs through consensus in ~30 s.

### Step 3 — Activate as counterparty

Switch MetaMask to the counterparty address. Open the NDA detail page, click "Activate & Stake" to post the matching stake. Status flips from Pending to Active.

### Step 4 — Report a suspected leak

While the NDA is Active and not expired, click "Report Leak" on the NDA card (or from the /report landing page). Paste a suspect URL, upload your Secret Vault + password to decrypt it, tick the keywords you believe are leaked, and pay the 1 GEN reporter fee. The tx is nondeterministic — validators fetch the URL + Wayback + Google independently. Expect 30 s – 3 min.

### Step 5 — Read the verdict and (optionally) appeal

The verdict panel shows verdict, confidence, responsible_party, prior_disclosure_found, match_score, and the AI's reasoning. If `violation_confirmed`, the responsible party can file a structured appeal (dropdown ground + evidence URL, plus date if PRIOR_DISCLOSURE) within 7 days. After the window, anyone in the NDA can call "Finalize Verdict" to release the 80/17/3 escrow split.

### Expected end state
Your seeded verdict shows on-chain, matches the pre-seeded records, and the event timeline logs each state transition with the validator-agreed metadata.

### If something goes wrong
- **"Wrong network" or `from` RPC error** — MetaMask is not on GenLayer Studio Network. Reload the page; the app calls `wallet_switchEthereumChain` on connect.
- **"Insufficient funds"** — MetaMask address has no GEN on studionet. Fund from the Studio Accounts panel (Step Prerequisites), not from a testnet faucet.
- **"Awaiting consensus…" for > 5 min** — validator load. Do not resubmit; the pending tx is authoritative.

---

## 04 — EXPECTED VERIFICATION OUTCOME (382 chars / cap 500)

Open NDA #3: status Leaked, red verdict panel shows verdict=violation_confirmed, responsible_party=party_b, confidence 94, match_score 96. Event timeline lists 6 events ending in appeal_upheld. Open NDA #4: status Active, green "Past leak reports" panel shows AI Jury verdict = No violation with 0/3 sources confirming. Both verdicts produced by validator consensus, not our server.

---

## 05 — LINKS

### Contract link
https://explorer-studio.genlayer.com/address/0x06be1A7897fD9f911eAF78383158A83d32485465

- **Address:** `0x06be1A7897fD9f911eAF78383158A83d32485465`
- **Network:** studionet
- **Status:** **Preview** (Studio deploy — never write "Live")
- **Verified via RPC:** `gen_getContractSchema` returned 25 methods, contract alive.
- **Verified via probe:** seeded NDA #3/4/3 (appeal) transactions all returned `GENVM RESULT: SUCCESS` + `CONSENSUS RESULT: Accepted` on the explorer.

### Website
https://nda-sentinel.vercel.app

### GitHub
https://github.com/phu1271997/nda-sentinel-genlayer

### Community links
Leave blank — none applicable.

---

## 06 — PRE-SUBMISSION CHECKLIST

**Truthfulness**
- [x] Every feature named in Description is exercised in the seeded records (violation, no-violation, appeal, multi-source cross-ref, structured appeal ground, publisher identity for attribution)
- [x] No feature described that is not yet built
- [x] Status set to **Preview** (studionet deploy)
- [x] Each category tag maps to a specific contract method (documented above)

**Deploy state**
- [x] All commits pushed to `main`
- [x] Vercel prod deploy `nda-sentinel.vercel.app` shows the latest build
- [x] `gen_getContractSchema` returns 25 methods
- [ ] **YOU (Peter):** open `explorer-studio.genlayer.com/address/0x06be1A7897fD9f911eAF78383158A83d32485465` in a browser once, confirm the transactions table shows `Accepted`/`SUCCESS` rows (SPA — do not curl)

**End-to-end test**
- [x] Records A, B, C seeded (chain-verified via `frontend/_seed/verify.mjs`)
- [ ] **YOU (Peter):** open `nda-sentinel.vercel.app/ndas/3` and `.../ndas/4` in incognito **without** a wallet, confirm the verdict panels + timeline render as described in Step 1
- [ ] **YOU (Peter):** walk "How to try it" once with a **fresh** MetaMask account funded from Studio Accounts, end at the "Expected verification outcome" state
- [ ] Optional: test on a different browser/machine

**Assets & limits**
- [x] Logo 1024×1024 PNG, 1.13 MB
- [x] One-liner 153 chars ≤ 180
- [x] Description 974 chars ≤ 1000
- [x] Expected verification outcome 382 chars ≤ 500
- [x] GitHub link present

**Consequences understood**
- Changes requested = **1 edit round, 14-day deadline**
- Declined = **not self-resubmittable**
- 1 Projects contribution = 1 Explorer entry

