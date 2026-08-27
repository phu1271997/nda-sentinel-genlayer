# GENLAYER PROJECT EXPLORER — SUBMISSION DRAFT
**Project:** NDA Sentinel · **Prepared:** 2026-08-27 · **Status: READY**

Character counts verified with `printf '%s' "$(cat FIELD)" | wc -m`. See
`deliverables/count-check.sh` for the reproducer.

## ⛔ BLOCKERS BEFORE SUBMIT
None — Gate 1 through Gate 5 pass. NDA #3 shows a full report → verdict →
appeal cycle on-chain and is reachable from the landing page and
`/violations`. If you want a second confirmed-leak record to strengthen the
verdict log, follow the seeding note below before submitting.

## OPTIONAL SEEDING (Gate 2 strengthen — not required)
Current state: 5 NDAs on chain, 1 confirmed leak (NDA #3) + 1 upheld appeal.
The reviewer already sees a full adjudication cycle. A second clean-negative
verdict (report → AI Jury rules `no_violation`) would give the verdicts log
a positive vs negative contrast. This requires the project owner's wallet
(needs GEN on studionet), so it is left for you:

1. From MetaMask on studionet, top up the wallet from Studio → Accounts.
2. Open the live URL, create an NDA between two of your addresses (`1 GEN`
   stake each, activation matches). Vault the salt file.
3. Report a URL that does **not** contain any of the vaulted keywords.
4. Wait for the AI Jury verdict (`no_violation`), then click Finalize.
5. On `/violations` you should now see one `leaked` NDA and one
   `no_violation` NDA side-by-side.

Total cost ≈ 3 GEN + gas.

---

## Project name
NDA Sentinel

## Primary category
**Dispute Resolution**

Rationale: the app's core mechanic is an adversarial adjudication loop
(report → validators fetch evidence → verdict → appeal) with staked money
at risk. `AI & Agents` is intentionally rejected because every project on
the Explorer is AI-powered — that tag no longer discriminates. `Governance`
is rejected because there is no vote/proposal surface.

## Category tags
- **Tag 1 — Evidence Assessment**
  Implemented by `report_leak()` at
  [`contracts/nda_sentinel.py:423`](../contracts/nda_sentinel.py). Its
  `leader_fn` fetches PRIMARY + WAYBACK + GOOGLE via
  `gl.nondet.web.render`, then asks the LLM to weigh them into a JSON
  verdict. Validators must agree on both the verdict and
  `sources_confirming ± 1`.
- **Tag 2 — Appeal Review**
  Implemented by `appeal()` at
  [`contracts/nda_sentinel.py:861`](../contracts/nda_sentinel.py). Takes
  an enum ground (`PRIOR_DISCLOSURE` / `ATTRIBUTION_ERROR` /
  `KEYWORD_MISMATCH`), an `http(s)://` evidence URL, and an evidence
  timestamp. The AI Jury re-adjudicates within a 7-day window and can
  overturn or uphold the original verdict.

Rejected tags:
- `Escrow Claims` — the escrow is a *side effect* of a verdict, not a
  deliverable-based two-party escrow. Reviewer would find no
  deliverable-condition surface.
- `License Claims` — the contract never reads license terms.
- `Moderation Appeals` — no moderation/takedown mechanic; the appeal
  reviews an AI Jury verdict, not a moderation action.
- `Jury Selection` — validators are selected by GenLayer, not by the app.

## Logo
- `deliverables/logo-1024.png` (1024×1024, PNG, 1.1 MB)
- `deliverables/logo-512.png` (512×512, PNG, 316 KB)
- `deliverables/logo.svg` (SVG source — shield + text motif)

## One-liner (112 chars / cap 180)
> AI Jury reads the suspect URL on-chain and slashes the leaker atomically — no $200k lawsuit, no 24-month wait.

## Description (956 chars / cap 1000)
> NDA Sentinel turns a signed paper NDA into an enforceable escrow. Party A commits sha256(keyword + salt) hashes on-chain, both sides stake GEN, and either party can later report a suspect URL. That fires report_leak, which runs gl.vm.run_nondet under eq_principle.prompt_comparative: every validator fetches PRIMARY + WAYBACK + GOOGLE via gl.nondet.web.render, asks its LLM for a JSON verdict, and only converges when the verdict AND sources_confirming count agree. Confirmed leaks split escrow 80/17/3 to reporter / non-violator / treasury. Violators can appeal within 7 days on an enum ground (PRIOR_DISCLOSURE / ATTRIBUTION_ERROR / KEYWORD_MISMATCH) with an evidence URL and timestamp — enforced by the contract, not the LLM. Publisher identities register on-chain via a proof-page fetch. Built for M&A advisors, tech startups, and litigation-settlement counsel: parties whose leaked secret is worth more than 1 GEN and less than $200k of legal spend.

## How to try it
Prerequisites — MetaMask with 3–5 GEN funded from Studio → Accounts on
studionet (public testnet faucet is a different chain and will not work).
Reading-only pages work without a wallet.

**Step 1 — Open the app and connect MetaMask.**
Visit https://nda-sentinel.vercel.app and click **Connect MetaMask** in
the header. The app calls `wallet_switchEthereumChain` and adds studionet
automatically if it is not registered.

**Step 2 — See the live protocol state.**
The landing page hero card is populated from a live `gen_call` to
studionet — you should see NDA count, confirmed leaks, GEN slashed, and
the treasury balance move as new activity lands. Open `/violations` for
the per-NDA verdict list.

**Step 3 — Inspect an adjudication cycle.**
Open `/ndas/3`. The NDA card shows `status = leaked`; the verdict panel
renders the AI Jury JSON (verdict, confidence, `sources_confirming`,
evidence quote, responsible party); the event timeline lists
`leak_reported` → `violation_confirmed` → `appeal_filed`
(`ground=KEYWORD_MISMATCH`).

**Step 4 (optional) — Create your own NDA and report a leak.**
Use `/ndas/new` to create an NDA with another address you control (stake
1–5 GEN). Vault the salt file. From `/report`, submit a URL that either
matches or does not match a keyword and observe the verdict + rationale.

Expected end state: at least one live NDA whose event timeline you can
walk from creation to verdict, plus a matching transaction on the
Explorer contract page showing `GENVM RESULT: SUCCESS`.

If something goes wrong:
- "insufficient funds" — MetaMask account has no GEN on studionet; refund
  from Studio → Accounts (Step 1 prerequisite).
- "wrong chain" / `'from'` error — MetaMask is on a different network;
  reconnect and let the app switch chain automatically.
- Verdict panel empty — the tx is still awaiting consensus; refresh after
  30–60 s. The event timeline shows the pending state until the AI Jury
  finalizes.

## Expected verification outcome (482 chars / cap 500)
> Open the live URL and go to /violations, then NDA #3. Status shows "leaked"; the verdict panel renders the AI Jury JSON (verdict, confidence, responsible_party, sources_confirming, evidence_quote) plus a lifecycle timeline including leak_reported → violation_confirmed → appeal_filed (ground=KEYWORD_MISMATCH). On the Explorer contract page you see a report_leak transaction with GENVM RESULT: SUCCESS and CONSENSUS RESULT: Accepted — proof the on-chain fetch + consensus ran.

## Contract link
https://explorer-studio.genlayer.com/address/0x06be1A7897fD9f911eAF78383158A83d32485465

- Address: `0x06be1A7897fD9f911eAF78383158A83d32485465`
- Network: **studionet** (chainId `61999` / `0xF1EF`)
- Status: **Preview** (Studio deploy — do NOT list as Live; §2.4 of the
  Portal rules)
- Verified via `gen_getContractSchema` — 25 methods present, including
  `report_leak`, `appeal`, `register_publisher_identity`,
  `get_events_for_nda`, `get_stats`.

## Website
https://nda-sentinel.vercel.app

## GitHub
https://github.com/phu1271997/nda-sentinel-genlayer

## Community links
Leave blank — no dedicated NDA Sentinel channel yet. General GenLayer
Discord is linked from the site footer.
