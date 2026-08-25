# NDA Sentinel

Trustless NDA enforcement dApp on GenLayer. An AI Jury reads the
suspect URL directly on-chain and reaches consensus on whether protected
information was disclosed; the smart contract atomically slashes and
distributes stakes based on the verdict, with a full appeal cycle.

- **Live App**: <https://nda-sentinel.vercel.app>
- **Class Name**: `NDASentinel`
- **Contract file**: [`contracts/nda_sentinel.py`](contracts/nda_sentinel.py)
- **Contract pragma**: `v0.2.20`
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Security model**: [SECURITY.md](SECURITY.md)
- **Architecture deep-dive**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 🔗 Deployed Contract

| Network    | Address | Explorer |
|------------|---------|----------|
| studionet  | `0x06be1A7897fD9f911eAF78383158A83d32485465` (v0.2.20) | [Open in Studio](https://studio.genlayer.com/?import-contract=0x06be1A7897fD9f911eAF78383158A83d32485465) |
| studionet (previous) | `0x817422E7aF4D86d848Bf9BC13b9A9c333CF341dd` (v0.2.19) | [Open in Studio](https://studio.genlayer.com/?import-contract=0x817422E7aF4D86d848Bf9BC13b9A9c333CF341dd) |

Prior addresses (superseded): `0xa39218…a7DE` (v0.2.18, 2026-07-30),
`0x10562A17…6F09` (v0.2.17, 2026-07-17), `0x42969f64…F2e0` (2026-06-18,
wiped by studionet reset). See
[`deployment/deployed_addresses.json`](deployment/deployed_addresses.json)
for provenance.

## Why GenLayer

Traditional NDAs cost $200k – $2M and take 18–36 months to enforce.
NDA Sentinel replaces that with:

- **On-chain suspect-URL fetching** (`gl.nondet.web.render`) — no oracle
  required.
- **On-chain LLM adjudication** (`gl.nondet.exec_prompt` inside
  `gl.eq_principle.prompt_comparative`) — validators agree on the verdict
  and slashing-critical scores, not on the specific wording of reasoning.

Neither part of that loop exists on Solidity or any other L1. Remove
either, and the protocol collapses back into a court-of-law dependency —
this is the "GenLayer fit" test in the Builders rubric.

## Architecture (high-level)

```text
  [ Party A & Party B ]
           |
     (1) Commit sha256(keyword + salt) hashes on-chain
     (2) Stake GEN into escrow
           |
  +-------------------+        (4) Validators independently
  | NDA Sentinel      | ------ fetch suspect_url via
  | (studionet)       |        gl.nondet.web.render
  |                   | <----- get their own copy of the page
  +-------------------+
           |
     (3) A party reports leak + salt
           |
    [ AI Jury via prompt_comparative ]
       -> agrees on verdict + responsible_party + prior_disclosure
       -> escrow split 80 / 17 / 3 to reporter / non-violator / treasury
       -> violator can appeal within 7 days, stake at risk
```

## Repository layout

```
contracts/          # Intelligent Contract Python
frontend/           # Next.js 16 App Router dApp
tests/              # gltest suite (32 tests, all green)
docs/               # ARCHITECTURE, DETECTION_RUBRIC, ECONOMICS, PRIVACY
deployment/         # deployed_addresses.json
CHANGELOG.md        # semver-tagged history of contract + frontend changes
SECURITY.md         # threat model, invariants, audit checklist
```

## Core Protocol Upgrades

Complete history is in [CHANGELOG.md](CHANGELOG.md). Highlights for the
current version (**v0.2.20** — 2026-08-11):

1. **genvm-lint E010 refactor**: every `gl.nondet.web.render` call is
   lexically inside its `eq_principle` closure — no nested helper — so the
   static linter recognises each fetch as a direct nondet call.
2. **Publisher identity authentication**:
   `register_publisher_identity(handle, proof_url)` fetches the proof URL
   inside `eq_principle.prompt_comparative` and only writes the mapping
   when validators agree the page carries BOTH the handle and the caller's
   lowercase hex address. Registered handles are injected into the leak
   jury prompt so attribution grounds in a verified out-of-band identity.
3. **Contract-verifiable appeals**:
   `appeal(nda_id, appeal_ground, evidence_url, evidence_timestamp,
   context_notes)` enforces an enum ground
   (`PRIOR_DISCLOSURE` / `ATTRIBUTION_ERROR` / `KEYWORD_MISMATCH`), an
   `http(s)://` evidence URL, and a strictly-pre-NDA `evidence_timestamp`
   for `PRIOR_DISCLOSURE` — the LLM is never asked to reason about dates.
4. **Multi-source cross-reference verdict** (v0.2.19 base): `report_leak`
   fetches PRIMARY + WAYBACK + GOOGLE inside `leader_fn`; validators must
   agree on `sources_confirming ± 1` too, so a bogus corroborating claim
   cannot ride through consensus.
5. **Reputation + on-chain event log** (v0.2.19 base): every address has a
   score keyed by `str` (R19); `events: DynArray[Event]` records 11 event
   kinds across the full NDA lifecycle, exposed via
   `get_events_for_nda(nda_id)` for the frontend timeline.
6. **Payment-conservation invariant**: `get_nda_liabilities` exposes
   `active_stakes + escrows + party_withdrawables + treasury`, exercised
   by lifecycle tests. Complete finalize path callable by reporter, either
   party, or anyone after a rescue window.
7. **Frontend wallet compliance (R21–R24)**: MetaMask is the primary
   signer; `wallet_switchEthereumChain` fires on connect; chain id is read
   from `studionet.id`; the local burner is kept as a demo-only fallback
   with a big amber warning.

## Step-by-Step Deploy Guide (studionet)

1. Open <https://studio.genlayer.com/contracts>.
2. **Settings → Reset Storage → Confirm** (per the deploy cheatsheet).
3. Hard refresh (Cmd + Shift + R).
4. New Contract → paste `contracts/nda_sentinel.py`.
5. Click Deploy (no constructor args).
6. **Click the finalized transaction and verify `Result: SUCCESS`** — a
   `Status: FINALIZED` on its own is not enough.
7. Copy the contract address (`0x…`).
8. `cd frontend` and create `.env`:
   ```bash
   NEXT_PUBLIC_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_ADDRESS
   ```
9. `npm install && npm run dev`.
10. Open <http://localhost:3000>. Connect MetaMask (studionet); fund the
    address from Studio → Accounts before your first write.

## Wallet setup for reviewers

- **MetaMask (preferred)**: click **Connect MetaMask** in the header. The
  app calls `wallet_switchEthereumChain` (or `wallet_addEthereumChain` on
  cold MetaMask installs) automatically. The chain id `61999` /
  `0xF1EF` is read from `studionet.id`, not hard-coded.
- **Burner (demo only)**: available as a fallback but has zero GEN and
  cannot pay stakes — good for read-only page previews, useless for
  reproducing the full flow.

## Tests

```bash
gltest
```

Runs the 32 tests in `tests/test_nda_sentinel.py`, including four
payment-conservation lifecycle tests, a two-cycle appeal-replay test,
5 reputation tests, 3 event-log tests, 3 publisher-identity tests, 5
structured-appeal tests, and a focused test proving the real
`web.render` fetch executes inside the equivalence-principle flow.
Requires `genlayer-test` in the Python environment.

## Where to find the leak-report flow (for reviewers)

Three entry points, all reachable without prior context:

1. **Home page** → red *Report a Leak* button next to *Create NDA*.
2. **Top nav** → *Report Leak* link on every page.
3. **My NDAs dashboard** → *Report Leak* button in the header, and a
   secondary button on every card whose status is `active`.

All three land on **`/report`**, which either:

- lets you look up any NDA by its numeric ID (from someone who shared it
  with you), or
- lists your own active NDAs with a one-click *Report Leak* button per
  card.

To submit a report you must be Party A or Party B of an *active* NDA and
hold the vault password + salt file generated during creation. The
report costs 1 GEN and triggers on-chain `web.render` + AI Jury
consensus — the tx typically finalises in 30 s – 3 min on studionet.

## Video demo

[//]: # (Add a demo video / GIF link here once recorded post-redeploy.)
