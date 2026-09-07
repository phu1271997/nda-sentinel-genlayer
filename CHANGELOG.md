# Changelog

All notable changes to NDA Sentinel are tracked here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/) for the contract pragma line.

Every entry lists the concrete files touched and cross-references the
resubmission-review feedback item(s) it addresses.

---

## [0.2.27] — 2026-09-07 — Milestone 2 Rebuild: AI-Adjudicated Bounty Board + Endorsement Web

**Contract change — redeploy required.**

**This entry SUPERSEDES the v0.2.23 badges+leaderboard milestone.** The
prior Milestone 2 was pure deterministic accounting — every badge
triggered from a counter, the leaderboard was a sort — and Solidity
could ship the same thing in an afternoon. This rebuild layers two
AI-native primitives on top so the milestone stands on GenLayer's own
capability set.

### Contract (`contracts/nda_sentinel.py`) — 8 new public methods

Bounty board:

- **`create_bounty(title, description, rubric, deadline) payable`**
  — Post a public bounty. Reward pool is locked at creation
  (≥ 0.1 GEN). Deadline: 1 hour – 60 days out.
- **`sponsor_bounty(bounty_id) payable`** — Anyone can top up an open
  bounty's reward pool.
- **`submit_bounty_entry(bounty_id, proof_url, notes)`** — Participants
  publish their work at `proof_url`; the AI Jury will fetch it at
  adjudication time. `notes` is advisory only. One entry per
  participant per bounty; 50 entries max per bounty.
- **`cancel_bounty(bounty_id)`** — Creator-only, before any entry.
  Full refund of the pool.
- **`adjudicate_bounty(bounty_id)`** — Anyone-callable after deadline.
  Runs `gl.eq_principle.prompt_comparative`: every validator
  independently fetches every entry's proof URL via `web.render`,
  scores against the rubric, and consensus-agrees on a ranked winner
  set (up to 5 winners) with `share_bps` payout split. Contract
  distributes pro-rata in a single tx, minus a 3 % protocol fee.
  Winner shares are rescaled + rounded so they always sum to 10000
  bps. Adjudicator earns the `adjudicator` badge — the operation is
  self-funding, someone in the community always wants to call it.

Endorsement web:

- **`endorse_user(target, proof_url, challenge, weight)`** — Cast a
  directed trust edge. Endorser must host a proof page containing
  their own address + target's address + challenge + the literal
  `ENDORSE`; validators AI-verify it via the shared
  `_run_attestation` primitive from v0.2.26. An adversary cannot
  forge an endorsement they cannot publish.
- **`revoke_endorsement(target)`** — Deterministic revocation with
  clean counter adjustment.
- **Endorsement score** — `get_endorsement_score(user)` returns the
  sum of received weights + a sub-linear count-bonus so a single
  whale cannot pump the graph on their own.

### Views (6 new)

`get_bounty`, `get_bounty_entries`, `get_user_bounties` (created +
entered), `get_open_bounties` (list of every still-open + within-window
bounty), `get_bounty_count`, `get_bounty_limits`;
`get_endorsements_received`, `get_endorsements_given`,
`get_endorsement_score`.

### Events (7 new)

`bounty_created`, `bounty_sponsored`, `bounty_entry_submitted`,
`bounty_adjudicated`, `bounty_cancelled`, `endorsement_created`,
`endorsement_revoked`.

### Notify kinds (5 new, wired into v0.2.24 inbox)

`bounty_created`, `bounty_entry_submitted`, `bounty_won`,
`bounty_adjudicated`, `endorsement_received`.

### New badge codes (5 stacked on the v0.2.23 badge system)

- `bounty_creator` — Bronze/Silver/Gold at 1/3/10 bounties posted.
- `bounty_winner` — auto-awarded on each adjudicated win.
- `endorsed_pro` — 5/10/25 endorsements received.
- `endorser` — 5/10/25 endorsements given.
- `adjudicator` — 1/5/10 successful adjudications run.

### Frontend (`frontend/`)

- **`/bounties`** — dashboard: open bounties table + your posted +
  entered lists.
- **`/bounties/new`** — creation form with rubric guidance.
- **`/bounties/[id]`** — full detail: rubric, entries list with
  clickable proof URLs, submit-entry / sponsor / cancel / adjudicate
  cards depending on state + wallet, winners table with rationale.
- **`/endorse`** — endorsement web: score card, endorse-someone form
  with copy-ready proof template + challenge auto-fill, list of
  endorsements you gave (with revoke) and received.
- **Nav** — `Bounties` (Coins icon) + `Endorse` (Handshake icon)
  entries added to the site header.

### Migration

- Independent storage from the v0.2.23 badge system — badge tier
  helpers just add three new codes; existing badge history is
  preserved.
- No off-chain indexer needed; every read is a single view call.

---

## [0.2.26] — 2026-09-07 — Milestone 1 Rebuild: Verified E2EE + AI-Attested Keys + Social Recovery

**Contract change — redeploy required.**

**This entry SUPERSEDES the previously-rejected v0.2.22 encryption
milestone.** Staff rejected v0.2.22 as too simple: the register path
was deterministic self-declaration (any address could bind any
pubkey — no attestation), which duplicated existing publisher_identity
plumbing without adding GenLayer-native value. v0.2.26 rebuilds the
milestone around the AI Jury and `gl.eq_principle.prompt_comparative`,
so every key-lifecycle transition is validator-consensus attested,
adds K-of-N guardian-based social recovery where each guardian
approval is ALSO AI-attested, per-NDA session-key rotation on live
encrypted vaults, and a per-user append-only key-transparency log.

### Contract (`contracts/nda_sentinel.py`) — 8 new public methods

- **`register_encryption_key_with_proof(pubkey, algo, proof_url, challenge)`**
  — AI-Jury-attested registration. Validators independently fetch
  `proof_url` via `gl.nondet.web.render` inside an `eq_principle`
  closure and must reach consensus on a FOUR-fact check: pubkey seen,
  address seen, challenge seen, kind seen (kind pins the operation so
  a page authored for REGISTER cannot be replayed as ROTATE). Fetch
  failure defaults to `verified=false` — no leader-only overrides.
- **`rotate_encryption_key(new_pubkey, new_algo, proof_url, challenge)`**
  — AI-attested rotation. Requires a currently VERIFIED key, then runs
  a fresh attestation on the new pubkey with kind `ROTATE`. Rotation
  counter increments; transparency log records prior + new pubkey
  fingerprints.
- **`revoke_encryption_key(reason_url, challenge)`** — AI-attested
  revocation. Blocks new encryptions to the key; existing envelopes
  stay locally decryptable. Kind `REVOKE`.
- **`set_recovery_guardians(guardians_json, threshold)`** — 2-of-N to
  7-of-N guardians. Deterministic write (the AI-attested step happens
  later per guardian approval).
- **`initiate_key_recovery(new_pubkey, new_algo)`** — user announces
  a replacement pubkey; guardians are inboxed to approve.
- **`guardian_approve_recovery(user_hex, approval_url, challenge)`**
  — a listed guardian AI-attests the target user's replacement pubkey
  by hosting an approval page containing user_addr + new_pubkey +
  challenge + literal `GUARDIAN_APPROVE`. Once threshold approvals
  accumulate the recovery finalizes atomically and the new pubkey
  replaces the old one.
- **`rotate_nda_session_key(nda_id, new_ct_a, new_ct_b, new_meta)`**
  — per-NDA session-key rotation on a live encrypted vault. Either
  party can call; old envelope pushed onto `nda_session_history_json`
  (last 5 rotations). Blocked if either party's key is REVOKED.
- **Six new views** — `get_encryption_key_status`,
  `get_encryption_key_card` (single-call profile with rotation counter
  + proof URL + last history entry), `get_key_history` (append-only
  100-entry audit log), `get_recovery_status`,
  `get_nda_session_history`, `get_verified_encryption_limits`.

### Contract gate change

- **`create_encrypted_nda`** now REQUIRES both parties'
  `get_encryption_key_status == "verified"`. UNVERIFIED
  self-declared pubkeys from the legacy path are rejected at contract
  level so the encrypted-NDA path always rests on an AI-attested
  foundation.

### Contract events (new)

`key_attestation_verified`, `key_rotation_finalized`, `key_revoked`,
`key_recovery_initiated`, `guardian_approved`, `key_recovery_finalized`,
`guardians_updated`, `nda_session_key_rotated`.

### Contract notify kinds (new — wired into v0.2.24 inbox)

`key_attestation_verified`, `key_rotation_finalized`, `key_revoked`,
`key_recovery_initiated`, `guardian_approved`,
`key_recovery_finalized`, `nda_session_key_rotated`.

### Frontend (`frontend/`)

- **`/keys` page** rewritten around the two-step attestation flow:
  step 1 = local keypair (generate + seal + unlock), step 2 = on-chain
  attestation with a copy-ready proof template that already includes
  the pubkey, address, challenge phrase and kind marker. Status card
  shows on-chain state (unverified / verified / rotating / revoked),
  rotation counter, and links to the current proof URL. Rotate + revoke
  buttons wired to the AI-attested contract methods.
- **`/keys/recovery` page (new)** — configure 2-of-N to 7-of-N
  guardians, announce a recovery (with in-browser fallback keypair
  generation + PKCS8 download), approve as a guardian (with a
  copy-ready guardian-approval proof template).
- **`/keys/history` page (new)** — reverse-chronological transparency
  log rendered from `get_key_history`.
- **`EncryptedContextPanel`** gains a "Rotate session key" action:
  decrypts locally, re-encrypts for both parties' current pubkeys,
  posts the fresh dual envelope via `rotate_nda_session_key`.
- **`NDAWizard`** now checks `get_encryption_key_status == "verified"`
  (via the new `RegistryEntry.status`) rather than mere existence —
  the "Encrypted mode" toggle is disabled until both parties are
  AI-attested.

### Docs

- `docs/ENCRYPTION.md` rewritten with the v0.2.26 lifecycle table,
  four-fact attestation prompt, guardian approval flow, session-key
  rotation semantics, and transparency-log design.

### Migration

- Legacy self-declared keys (pre-v0.2.26) are automatically marked
  `unverified` on the next contract deploy — they cannot back new
  encrypted NDAs until the owner re-registers via
  `register_encryption_key_with_proof`.
- Encrypted NDAs already on-chain from a pre-v0.2.26 deploy will not
  exist against the new contract address (studionet resets between
  deploys), so no data migration path is required.

---

## [0.2.25] — 2026-09-07 — Multi-Party (Group) NDA + Threshold Consensus

**Contract change — redeploy required.**

Milestone 4 of 4. Extends the protocol from 1:1 NDAs to multi-party
group NDAs supporting 3–10 signers with configurable activation
threshold and proportional-stake compensation. When a leak is
confirmed inside a group, the AI Jury must attribute the violation to
one of the group's own listed addresses; the contract slashes that
address's stake and distributes compensation to every non-violator in
proportion to their own stake share.

### Contract (`contracts/nda_sentinel.py`)
- **New dataclass** `GroupNDA` — id, creator, scope, context, expiry,
  threshold, parties_count, activated_count, status, timestamps,
  keyword_hash_count, total_stake, slashed_amount, violator, reporter,
  suspect_url, verdict_json.
- **`create_group_nda(parties_json, scope, context, expiry, threshold,
  keyword_hashes_json)`** — payable. Validates 3–10 unique parties
  (caller must be listed), threshold in [1, N], salted-hash format,
  min stake ≥ 0.1 GEN. Marks the creator as the first activated
  party. Notifies every other party via the v0.2.24 inbox.
- **`join_group_nda(group_id)`** — payable. Late-comer activation.
  Any listed party who has not yet activated calls this with their
  stake; when the activation count crosses `threshold`, the NDA flips
  to `active` and every party is inboxed.
- **`report_group_leak(group_id, suspect_url, revealed_keywords_json,
  salt)`** — payable. Any listed party can call. Runs a bespoke
  eq_principle prompt asking the jury to attribute the leak to one
  address on the group members list (or "unknown"). Confirmed
  violations slash the violator's stake, pay the reporter an 80 %
  reward, drop a 3 % treasury fee, and distribute the remaining
  compensation across non-violators weighted by their stake shares.
  Awards the reporter's `confirmed_hunter` badge tier.
- **`expire_group_nda(group_id)`** — anyone-callable post-expiry cleanup
  that refunds every remaining stake to its owner.
- **Views** — `get_group_nda(id)`, `get_group_membership(id)` (merged
  address + stake + activated rows), `get_user_group_ndas(user)`,
  `get_group_count()`, `get_group_keyword_hashes(id)`,
  `get_group_limits()`.
- **New events** — `group_nda_created`, `group_nda_joined`,
  `group_nda_activated`, `group_leak_reported`,
  `group_violation_confirmed`, `group_nda_expired`.
- **New notify kinds** — `group_nda_created`, `group_nda_activated`,
  `group_violation_confirmed` wired into the v0.2.24 inbox so every
  member gets a receipt at each lifecycle stage.
- **Storage** — `group_ndas: DynArray[GroupNDA]`, `group_index_by_id`,
  `group_parties_json`, `group_stakes_json`, `group_activated_json`,
  `group_keyword_hashes_json`, `group_user_ids_json`, `next_group_id`.

### Frontend (`frontend/`)
- **`/ndas/new-group`** — 3–10 party wizard with dynamic add/remove
  rows, threshold selector (0 = default to all parties), same
  salted-hash + vault-download flow as 1:1 NDAs.
- **`/groups`** — dashboard of the caller's group NDAs (status pill,
  activation ratio, total stake, deep link).
- **`/groups/[groupId]`** — detail page with member table (stake +
  activated flag + explorer link), join card for non-activated
  members, report-leak card for active members, expire card once past
  expiry, verdict card with attribution + slash amount + evidence
  URL on `leaked` status.
- **Nav** — new "Groups" link (Users icon) in the site header.

### Migration
- Uses independent storage from 1:1 NDAs — no state migration.
- The 1:1 flow (`create_nda`, `report_leak`, `appeal`) is untouched;
  existing NDAs behave exactly as before.

---

## [0.2.24] — 2026-09-07 — On-chain Notification Inbox + Preferences

**Contract change — redeploy required.**

Milestone 3 of 4. Adds a per-address on-chain inbox: every lifecycle
event touching a user (party to the NDA, reporter, appellant, settler,
or badge earner) enqueues a rich notification the user can read, mark
read, clear, and pre-filter by kind. A polling bell in the site header
surfaces the unread count, and an opt-in browser Notifications hook
mirrors it to the desktop OS. Preferences are stored on-chain so they
follow the wallet across devices.

### Contract (`contracts/nda_sentinel.py`)
- **`_notify(recipient, kind, nda_id, title, body)`** private helper
  respects per-user opt-outs, caps queue length at 200 (drops from the
  head, adjusts the unread counter accordingly), and emits a
  `notification_queued` event alongside the inbox write.
- **Lifecycle wire-ups** — inserts `_notify` calls at:
  `create_nda`, `create_encrypted_nda` (counterparty),
  `activate_nda` (party A), `cancel_pending_nda` (party B),
  `report_leak` (reporter + violator + non-violator),
  `appeal` (original reporter),
  overturn path (appellant + reporter),
  upheld path (appellant + reporter),
  `_finalize_verdict_internal` (reporter + non-violator),
  `expire_and_withdraw` (both parties),
  `_award_badge` (recipient).
- **Views** — `get_inbox(user)`, `get_inbox_page(user, from, limit)`
  (reverse-chronological, page cap 100), `get_inbox_unread_count(user)`,
  `get_notify_prefs(user)`, `get_notify_kinds()` (list of 11 kinds).
- **Writes** — `set_notify_prefs(prefs_json)` (validated whitelist +
  boolean-only values), `mark_inbox_read(up_to_seq)`,
  `mark_all_inbox_read()`, `clear_read_inbox()`.
- **New events** — `notification_queued`, `notification_prefs_updated`.
- **Storage** — `user_inbox_json`, `user_inbox_unread`,
  `user_inbox_next_seq`, `user_notify_prefs_json`.

### Frontend (`frontend/`)
- **`components/InboxBell.tsx`** — polls `get_inbox_unread_count` every
  30 s, badges the site header with the unread count, and optionally
  fires a browser Notification when the count rises (uses
  `localStorage` to dedupe).
- **`/inbox` page** — reverse-chronological feed with unread pill,
  Mark-all-read / Clear-read buttons, per-kind preference toggles that
  post to `set_notify_prefs`, deep-links to the referenced NDA.
- **Browser Notifications opt-in** — prompt + status card on the same
  page (unsupported / default / granted / denied).
- **Nav** — bell added to the site header next to the "Create NDA" CTA.

### Migration
- Every existing user starts with an empty inbox and default (all-on)
  prefs — no migration script needed.
- Contract storage grows per-notification; the 200-entry cap plus the
  `clear_read_inbox` write keeps it bounded.

---

## [0.2.23] — 2026-09-07 — Achievement Badges + Leaderboard

**Contract change — redeploy required.**

Milestone 2 of 4. Adds a soul-bound-style achievement layer that
auto-mints as users interact with the protocol: create an NDA, activate
one, submit a leak report, win an appeal, hit reputation thresholds,
register a publisher identity, register an encryption key, or clear
enough settlements. Badges are non-transferable, tiered, and derived
deterministically from the contract's existing state — no admin call
grants them.

### Contract (`contracts/nda_sentinel.py`)
- **Badge codes** (10 total): `first_nda`, `first_activation`,
  `first_report`, `confirmed_hunter` (tiers 1/5/10/25),
  `appeal_champion` (tiers 1/3/5), `verified_publisher`,
  `encrypted_adopter`, `slashed_whale` (tiers 10/100/1000 GEN),
  `settler` (tiers 3/5/10), `reputation_elite` (score ≥ 1300).
- **Auto-award hooks** wired into `create_nda`, `create_encrypted_nda`,
  `activate_nda`, `report_leak` (report + confirmed hunter + whale +
  elite check), `appeal` (overturn winners), `register_publisher_identity`,
  `_finalize_verdict_internal` (settler).
- **Storage** — `user_badges_json`, `badge_holders_json` (index of
  addresses per code), `user_settle_count`, `user_total_slashed`,
  and a leaderboard snapshot pair (`leaderboard_snapshot_json`,
  `leaderboard_snapshot_at`).
- **Views** — `get_badges(user)`, `get_badge_holders(code)`,
  `get_badge_catalog()`, `get_user_scorecard(user)` (single-call profile),
  `get_leaderboard()`.
- **Write** — `rebuild_leaderboard(top_k)` walks the badge-holder indexes,
  sorts by (badge_score desc, reputation desc, confirmed_reports desc),
  and writes the top-K snapshot. Gas-bounded: `top_k` clamped 1–100,
  scan uses the flat holder indexes (no per-NDA walk).
- **Events** — `badge_awarded`, `reputation_elite_reached`.

### Frontend (`frontend/`)
- **`components/BadgeGrid.tsx`** — presentation for 10 badge codes with
  gradient icon tiles, tier labels (Bronze / Silver / Gold / Platinum),
  and tooltip descriptions.
- **`/badges` page** — full scorecard for the current wallet: reputation,
  counters, badges owned, badge-catalog table with holder counts.
- **`/leaderboard` page** — table of the top 25 addresses from the
  contract snapshot with #1–#3 highlighted and a "Rebuild" button that
  invokes `rebuild_leaderboard(25)`.
- **Nav** — "Badges" (award icon) and "Leaderboard" (trophy icon)
  entries added to the site header.

### Migration
- No storage migration needed — TreeMap lookups return the empty default
  for any address that has not yet earned a badge.
- Historic users won't get retroactive badges until they touch the
  protocol again; the award hooks fire on the next lifecycle event.

---

## [0.2.22] — 2026-09-07 — E2E Encryption Vault + Public Key Registry

**Contract change — redeploy required.**

Milestone 1 of 4. Adds an end-to-end-encrypted NDA path so that the
substantive contract text and the raw keyword list never leave the
parties' browsers in plaintext. Before this release the on-chain
`context_description` was arbitrary free text readable by every state
observer; from v0.2.22 an encrypted NDA reveals only a short public
hint on-chain and the substantive payload lives inside a dual-envelope
AES-GCM ciphertext addressed to each party's registered public key.

### Contract (`contracts/nda_sentinel.py`)
- **Pubkey registry** — `register_encryption_key(pubkey_hex, algo)`
  writes a per-address ECDH-P256 (130 hex chars, `04`-prefixed
  uncompressed raw) or X25519 (64 hex chars) public key with a
  deterministic write path (no LLM). Companion views
  `get_encryption_key(user)` and `has_encryption_key(user)` expose
  the entry to callers.
- **Encrypted NDA path** — `create_encrypted_nda(counterparty_hex,
  scope, public_hint, expiry, keyword_hashes_json, ciphertext_for_a,
  ciphertext_for_b, envelope_meta_json)` mirrors `create_nda` but
  requires (a) both parties to have a registered key, (b) a short
  `public_hint` (≤100 chars) instead of the free-form
  `context_description`, and (c) two distinct AES-GCM ciphertexts.
  Emits both `encrypted_nda_created` and the standard `nda_created`
  event so analytics dashboards treat encrypted NDAs uniformly.
- **Per-NDA storage** — `nda_ciphertext_a/b`, `nda_ciphertext_meta_json`,
  and `nda_is_encrypted` TreeMaps back the new envelope path.
- **View** — `get_encrypted_context(nda_id)` returns both envelopes and
  the metadata so parties can decrypt locally, and
  `get_encryption_limits()` publishes the length + algorithm limits so
  the frontend never has to hard-code them.
- **New events** — `encryption_key_registered`, `encrypted_nda_created`.
- **Deterministic validation only** — algo whitelist
  (`ecdh-p256`, `x25519`), lowercase-hex normalization, algorithm-specific
  length gates, ciphertext length gates (32–8000 chars), distinct-envelope
  check so a mistaken single-recipient encrypt cannot slip through.

### Frontend (`frontend/`)
- **`lib/e2ee.ts`** — WebCrypto-only ECDH-P256 → HKDF-SHA-256 → AES-256-GCM
  primitives. Ephemeral sender keypair per envelope so ciphertexts do not
  link two encrypted NDAs sharing recipient keys. Also exports a
  password-protected `sealKeystore` / `openKeystore` pair (PBKDF2-SHA256,
  250 000 iterations, AES-GCM wrap of the PKCS8 private key).
- **`lib/keyring.ts`** — session-scoped unlocked-keypair cache +
  localStorage-backed sealed keystore, keyed by wallet address.
- **`/keys` page** — generate, unlock, lock, delete, export, or import a
  sealed keystore; publish the on-chain public key; status card shows
  local vs. on-chain sync.
- **NDAWizard** — new "Encrypted NDA" toggle in step 1 that becomes
  available once both parties have registered a key and the caller's
  keystore is unlocked. When on, the wizard collects a `public_hint`,
  generates the dual envelope client-side, and submits via
  `create_encrypted_nda`.
- **NDA detail** — new `EncryptedContextPanel` renders on any encrypted
  NDA. The party addressed by the envelope can decrypt in-browser with
  their locally-held private key.
- **Nav** — new "Keys" link (emerald, key-round icon) in the site header.

### Docs
- `docs/ENCRYPTION.md` — threat model, wire format, envelope layout,
  KDF choice, rotation caveats.

### Migration
- Existing v0.2.21 NDAs continue to work through `create_nda` /
  `get_nda`; `get_encrypted_context` returns `is_encrypted=false` for
  every legacy NDA.
- Wallet holders who want the encrypted path must call
  `register_encryption_key` once. Losing the local password means
  losing access to any envelope encrypted to that key — the contract
  cannot recover it.

---

## [0.2.21.1] — 2026-08-30 — UX Enhancement + Analytics Dashboard

Frontend-only. Contract ABI unchanged; no redeploy required.

### Frontend
- **Analytics dashboard** (`frontend/app/analytics/page.tsx`) — new
  `/analytics` route with server-fetched on-chain data: 4 stat cards
  (total NDAs, violations confirmed, value slashed, treasury), 3 health
  metrics (detection rate, appeal overturn rate, event count), recharts
  event breakdown bar chart, appeal outcome pie chart. Data refreshes
  every 60 s via studionet RPC.
- **NDA lifecycle stepper** (`frontend/components/NDALifecycleStepper.tsx`)
  — visual horizontal stepper on `/ndas/[ndaId]` detail page showing
  Pending → Active → Reported → Appealed → Finalized with current state
  highlighted. Terminal states (Expired, Cancelled) render as a single
  pill.
- **Analytics charts** (`frontend/components/AnalyticsCharts.tsx`) —
  client component: recharts `BarChart` for event breakdown by type,
  `PieChart` for appeal outcomes, color-coded per event kind.
- **Navigation** — "Analytics" link with chart icon added to site header.
- **Accessibility** — skip-to-content link in root layout, `role="main"`
  + `id="main-content"` on `<main>`, ARIA `role="list"` on lifecycle
  stepper.
- **SEO** — `robots.txt` + Next.js `sitemap.ts` covering all 7 routes.
- **Event data layer** (`frontend/lib/onchain-stats.ts`) —
  `fetchEventBreakdown()` fetches up to 200 events via
  `get_events(offset, limit)` and aggregates by kind.

---

## [0.2.21] — 2026-08-30 — Security Hardening Bundle v1

**Contract change — redeploy required.**

### Contract (`contracts/nda_sentinel.py`)
- **Minimum stake enforcement** — `MIN_STAKE_WEI = 0.1 GEN` replaces the
  prior `> 0` check in both `create_nda` and `activate_nda`. Prevents
  dust-stake griefing (thousands of near-zero-stake NDAs polluting indexes).
- **`suspect_url` validation** in `report_leak` — scheme must be `http://`
  or `https://`, length capped at 2048 chars. Aligns with existing checks
  in `appeal` and `register_publisher_identity`.
- **Hex-only keyword hash validation** in `create_nda` — ensures every hash
  is valid lowercase hex, not arbitrary 64-char strings.
- **Duplicate keyword hash rejection** in `create_nda` — prevents inflated
  `keyword_hash_count` via repeated hashes.
- **`get_nda_count()` view** — returns `next_nda_id` for O(1) enumeration
  without scanning the full NDA array.

### Tests (`tests/test_nda_sentinel.py`)
- 7 new fast-bucket tests covering every new validation guard:
  `test_create_nda_rejects_duplicate_keyword_hashes`,
  `test_create_nda_rejects_non_hex_keyword_hash`,
  `test_create_nda_rejects_dust_stake`,
  `test_activate_nda_rejects_dust_stake`,
  `test_report_leak_rejects_non_http_url`,
  `test_report_leak_rejects_overlong_url`,
  `test_get_nda_count_tracks_creation`.

### Frontend (`frontend/next.config.ts`)
- Security headers added: `X-Content-Type-Options`, `X-Frame-Options`,
  `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`.

### Documentation
- `SECURITY.md` updated to v0.2.21 — new §6 "Input validation hardening"
  documents all guards with rationale table.
- `CONTRIBUTING.md` added — project structure, code conventions, PR process.
- `CHANGELOG.md` — this entry.

---

## [0.2.20.2] — 2026-08-27 — Explorer-ready landing polish + test bucketing

Frontend-only + tests-only. Contract ABI unchanged; no redeploy required.

### Frontend
- **Sticky glassy top nav** (`frontend/components/SiteHeader.tsx`) —
  same brand across every route, active-route highlight, mobile
  disclosure, live `studionet` badge next to the logo. Replaces the
  per-page inline `<header>` that lived on the landing page only.
- **Rich 4-column site footer** (`frontend/components/SiteFooter.tsx`)
  — Product / Protocol / Resources / Community columns, contract
  address auto-links to Explorer, network + chainId + license line at
  the bottom. Replaces the old one-line `ContractInfoFooter` (removed).
- **Landing rewrite** (`frontend/app/page.tsx`) — hero + live stats
  card, problem breakdown ($200k–$2M / 18–36 months / judgment ≠
  collection), 5-step how-it-works with per-step CTA, on-chain
  live-state grid, 8 consensus-signal callouts, ASCII architecture
  diagram, use-cases, traditional-NDA-vs-us compare table,
  reviewer-focused "how to try it in 3 steps", 6-item FAQ, final CTA.
- **Live protocol stats** (`frontend/lib/onchain-stats.ts`) — server
  component fetches `get_stats` + `get_events_count` from studionet
  RPC on every render with `revalidate: 60`; the numbers on the
  landing page are the actual on-chain state.
- **Global layout** (`frontend/app/layout.tsx`) — `SiteHeader` +
  `SiteFooter` mounted once so every route inherits the same shell.
  OpenGraph metadata added.

### Tests
- **Fast / slow bucket split** (`tests/conftest.py`) — every existing
  test auto-tagged; multi-cycle payment/reputation/event lifecycle
  tests get `@slow`, everything else gets `@fast`. Run either bucket
  with `gltest -m fast` or `gltest -m slow`.
- **5 new read-only smoke tests** (appended to
  `tests/test_nda_sentinel.py`) — pin the shape of
  `get_stats`, `get_reputation_thresholds`, `get_events`,
  `get_events_for_nda`, and `get_publisher_identity` on a fresh
  deploy. These fail the suite before a schema drift ever reaches the
  dashboard.
- **`tests/README.md`** — marker map + run examples.

### Docs / Deliverables
- `deliverables/SUBMISSION.md` — Explorer submission draft with hard
  character counts for every capped field.
- `deliverables/logo-1024.png` / `logo-512.png` reused from
  `frontend/public/`.

---

## [0.2.20.1] — 2026-08-25 — Frontend: on-chain event timeline + README v0.2.20 sync

Contract ABI is unchanged; no redeploy required. Frontend-only surface
of the event log the v0.2.19 contract already emits, plus a documentation
sync so the top-level README reflects the actual deployed pragma.

### Frontend
- **New `EventTimeline` component** (`frontend/components/EventTimeline.tsx`)
  — renders the on-chain event log for a single NDA via
  `get_events_for_nda(nda_id)`. All 11 event kinds
  (`nda_created`, `nda_activated`, `nda_cancelled`, `leak_reported`,
  `violation_confirmed`, `appeal_filed`, `appeal_overturned`,
  `appeal_upheld`, `verdict_finalized`, `nda_expired`, `withdraw`) plus
  `publisher_registered` get their own icon, colour, timestamp, actor
  link, and typed `meta_json` summary (stakes/reward/appeal ground/etc.
  formatted from wei to GEN).
- **NDA detail page** (`frontend/app/ndas/[ndaId]/page.tsx`) — hooks the
  timeline into the bottom of every NDA page so reviewers can trace the
  full lifecycle without cross-referencing tx hashes on the explorer.
- **`ContractEvent` + `EventKind` types** added to
  `frontend/lib/types.ts`.

### Docs
- README `## Core Protocol Upgrades` rewritten around v0.2.20 (was
  frozen on v0.2.18 wording); test count updated 14 → 32; contract
  pragma line already correct.

---

## [0.2.20] — 2026-08-11 — Reviewer round 3: lint + focused fetch test + publisher identity + contract-verifiable appeal

Addresses the four items from the round-3 reviewer note:
> *"Please refactor the nested web-fetch path so current genvm-lint no
> longer reports E010, and add a focused test showing the real fetch
> executes within the equivalence-principle flow. For a stronger
> enforcement model, also authenticate publisher identity and make
> appeal evidence contract-verifiable rather than free-form prose."*

### 1. genvm-lint E010 — nested web-fetch path refactor

- `report_leak.leader_fn` no longer delegates `gl.nondet.web.render`
  calls through a nested `_safe_fetch(url, max_chars)` helper. All three
  fetches (PRIMARY / WAYBACK / GOOGLE) are now lexically inside the
  `leader_fn` closure, one `try/except gl.nondet.web.render(...)`
  block per source, so the static linter sees each call as a direct
  nondet call of the `eq_principle.prompt_comparative` path.
- Same treatment for the new `register_publisher_identity` and
  restructured `appeal` closures.

### 2. Focused test that the real fetch fires inside `eq_principle`

- `test_web_render_executes_inside_equivalence_principle_flow`
  installs a distinctive marker string as the PRIMARY suspect URL's
  body and wires the LLM mock to only return `violation_confirmed`
  **iff the marker appears in the prompt**. A catch-all guardrail LLM
  mock returns `no_violation` when the marker is missing. The test
  asserts:
  1. NDA status transitions to `leaked` (only possible via a
     marker-bearing prompt),
  2. `nda.suspect_url` matches,
  3. `verdict_json.evidence_quote` contains the marker string — direct
     proof the fetched body flowed through consensus into storage.

### 3. Publisher identity authentication

- New storage: `publisher_handle: TreeMap[str, str]`,
  `publisher_proof_url`, `publisher_verified_at`.
- New method `register_publisher_identity(handle, proof_url)`:
  fetches `proof_url` via `gl.nondet.web.render` inside
  `gl.eq_principle.prompt_comparative`, and only writes the mapping
  when validators unanimously agree the page contains BOTH the handle
  AND the caller's lowercase 0x-prefixed hex address.
- New view `get_publisher_identity(user) -> str` (JSON:
  `{handle, proof_url, verified_at}`).
- `report_leak.leader_fn` now injects both parties' registered handles
  into the jury prompt, so `responsible_party` attribution grounds in
  a verified out-of-band identity instead of free-text guessing.
- New event kind `publisher_registered` for the on-chain event log.
- 3 new tests: happy path, verified=false rejection, malformed URL.

### 4. Contract-verifiable appeal (structured claims)

- `appeal(nda_id, appeal_ground, evidence_url, evidence_timestamp,
  context_notes)` — the ABI now enforces every claim's shape:
  - `appeal_ground` MUST be one of `PRIOR_DISCLOSURE`,
    `ATTRIBUTION_ERROR`, `KEYWORD_MISMATCH`.
  - `evidence_url` MUST be an 8–500-char `http(s)://` URL.
  - `PRIOR_DISCLOSURE` requires a non-zero `evidence_timestamp`
    strictly BEFORE the NDA's `created_at` — enforced by the contract,
    NOT the LLM.
  - `context_notes` is a length-bounded advisory string that CANNOT be
    the sole basis of an overturn.
- `Appeal` dataclass grows `appeal_ground`, `evidence_url`,
  `evidence_timestamp` fields. `counter_evidence` is now a
  machine-readable JSON blob of the structured claim.
- The appellate `leader_fn` fetches the appellant's `evidence_url`
  inline (E010-safe) and emits a ground-specific prompt. The
  `prompt_comparative` principle now agrees on
  `evidence_supports_ground` too, so an unsupported claim cannot ride
  through consensus.
- New view `get_appeal_grounds() -> str` for the frontend enum select.
- 5 new tests: unknown-ground rejection, non-http rejection, zero-
  timestamp rejection, post-NDA timestamp rejection, pre-NDA happy
  path with persistence check.

### Tests

- 22 → **32 tests, all green** (10 new).

### Frontend

- New page `/identity` (`frontend/app/identity/page.tsx`) — publishers
  register handle + proof URL, contract verifies on-chain.
- NDA detail appeal panel rewritten around the enum: dropdown for
  `appeal_ground`, `evidence_url` field, conditional date picker for
  `PRIOR_DISCLOSURE` (capped at NDA-creation-minus-one-day), optional
  context notes.
- Landing page + dashboard: `Identity` link added.
- `frontend/lib/types.ts`: new `Appeal` and `PublisherIdentity` types.

### Redeploy required

`v0.2.19` (`0x817422E7aF4D86d848Bf9BC13b9A9c333CF341dd`) has the old
`Appeal` storage shape and no `register_publisher_identity` or
`get_appeal_grounds` methods. **Deploy `contracts/nda_sentinel.py` v0.2.20
fresh on studionet, then update `NEXT_PUBLIC_CONTRACT_ADDRESS` in
Vercel** — the new appeal + identity UI will fail against the old
contract until the address swap is done.

---

## [0.2.19.1] — 2026-08-02 — Frontend UX: surface the Report Leak flow

Contract ABI is unchanged; no redeploy required. Pure frontend fix in
response to reviewer feedback: *"there is no section for checking if an
NDA was breached, the dApp only allows creating an NDA"*. The
report-leak feature already existed at `/ndas/[ndaId]/report` but every
entry point to it was gated behind "be a party of an already-active
NDA", which a first-time reviewer never satisfies.

### Frontend
- **New `/report` landing page** (`frontend/app/report/page.tsx`) —
  primary discovery surface for the leak flow. Lets any visitor look up
  an NDA by ID, or pick from their own active NDAs, and jump straight
  into `ReportLeakForm`.
- **Landing page redesign** (`frontend/app/page.tsx`) — adds a red
  *Report a Leak* CTA next to *Create NDA*, a top-nav link, and a
  5-step "Full protocol lifecycle" explainer (Create → Activate →
  **Report Leak** → AI Jury Verdict → Appeal or Slash) that walks
  reviewers through the entire end-to-end path.
- **NDACard** (`frontend/components/NDACard.tsx`) — adds a secondary
  *Report Leak* button on cards whose status is `active`, so the leak
  path is reachable in one click from the dashboard.
- **Dashboard** (`frontend/app/ndas/page.tsx`) — *Report Leak* button in
  the header row and in the empty state.

### Docs
- README: added a *Where to find the leak-report flow* section with
  three direct entry points.

---

## [0.2.19] — 2026-07-31 — Reputation + multi-source cross-reference + event log

Bundles three new capabilities. Each maps to one Portal milestone
submission per the Builder Points rubric (Loại 3c, 1b, 4).

### Milestone A — Reputation system (Loại 3c)

- `reputation_score: TreeMap[str, u256]` keyed by lowercase address hex
  (R19 policy). Baseline 1000, clamped at 0.
- `reputation_initialized[key]` lets `_rep_get()` return baseline lazily
  without a write so views stay cheap.
- Deltas: +50 on confirmed report, -100 on confirmed violation, +100 on
  overturn win, -75 on false report. Overturn also rolls back the two
  deltas the original report applied, so a proven-innocent appellant
  and their reporter net out to the correct final position.
- Per-address counters: `reporter_reports_count`, `reporter_confirmed_count`,
  `violator_confirmed_count`, `overturn_wins_count`, `false_report_count`.
- Views: `get_reputation(user)` returns `{score, tier, baseline, ...}` as
  JSON; `get_reputation_thresholds()` exposes the tuning constants.
- Tiers: `verified` (≥ 1200), `trusted` (≥ 1050), `newcomer` (default),
  `flagged` (< 800).
- 5 new tests: baseline, confirmed-report reward, overturn rollback,
  threshold constants, underflow-clamp under 11 consecutive slashes.

### Milestone B — Multi-source cross-reference verdict (Loại 1b)

- `report_leak` now fetches THREE sources per report inside `leader_fn`
  (drop-in — no ABI change):
  - `PRIMARY` = user-supplied suspect_url (up to 6 000 chars).
  - `WAYBACK` = `https://web.archive.org/web/*/{suspect_url}` snapshot,
    used to detect prior public disclosure.
  - `GOOGLE` = search for the first revealed keyword, used as a second
    prior-disclosure signal.
- Failed corroborating fetches degrade to `null` — the primary source
  failing still forces the verdict to `inconclusive`, but a corroborating
  source failing only lowers confidence (rule (7)+(8) in the validator
  principle).
- New response fields: `sources_evaluated`, `sources_confirming`,
  `cross_reference_notes`. Validator principle now agrees on
  `sources_confirming ± 1` too, so a bogus cross-reference claim can't
  ride through consensus.

### Milestone C — Event log + notifications (Loại 4)

- `events: DynArray[Event]` append-only log; every state transition emits
  one event via `_emit(kind, nda_id, actor, meta)`.
- 11 event kinds: `nda_created`, `nda_activated`, `nda_cancelled`,
  `leak_reported`, `violation_confirmed`, `appeal_filed`,
  `appeal_overturned`, `appeal_upheld`, `verdict_finalized`,
  `nda_expired`, `withdraw`.
- Views: `get_events_count()`, `get_events(from_seq, limit)` (paginated,
  100/page cap), `get_events_for_nda(nda_id)`.
- `meta_json` is a free-form JSON string so downstream consumers can
  extend without a schema migration.
- 3 new tests covering lifecycle ordering, per-NDA filter, and pagination
  bounds. Full suite: 19 → 22 tests, all green.

### Tests
- Full contract test suite grew from 14 → 22 (all green).

### Redeploy required
`v0.2.18` (`0x10562A17…6F09`) does not have the new views or the event
log. Redeploy `contracts/nda_sentinel.py` on studionet and update
`NEXT_PUBLIC_CONTRACT_ADDRESS` before shipping the frontend build.

---

## [0.2.18] — 2026-07-30 — Resubmission-review fixes + wallet UX overhaul

### Contract — `contracts/nda_sentinel.py`

#### Deadline protection completeness
- **Reject leak reports on expired NDAs.** `report_leak` now hard-rejects
  reports where `_now() >= expiry_timestamp`. Previously a leak reported one
  second past expiry was accepted because status was still `"active"`, which
  let a reporter slash a stake that should have been withdrawable via
  `expire_and_withdraw`.
- Reason: "deadline and replay protections" — review item.

#### Replay protection completeness
- **Reset `appeal_submitted[nda_id]` on overturned verdict.** The per-verdict
  replay guard used to persist across the overturn transition, permanently
  locking any legitimate future violator on the same NDA out of appeal. The
  overturn path now clears the flag together with `suspect_url` and
  `verdict_json`, giving the NDA a clean slate.
- New regression test: `test_replay_across_two_verdict_cycles`.
- Reason: "deadline and replay protections" — review item.

#### Collateral restoration correctness
- **Wipe stale accusation artifacts alongside stake restoration.**
  `suspect_url` and `verdict_json` are cleared when a verdict is overturned,
  matching the reset of `violator`, `reporter`, and `appeal_deadline`.
- **Underflow-safe stat rollbacks.** `total_violations_confirmed` and
  `total_value_slashed` are decremented with an explicit guard so that a
  future refactor cannot cause a wrap-around.
- Reason: "collateral restoration" — review item.

#### Complete the appeal and reward call paths
- **New `finalize_verdict(nda_id)`** with relaxed authorisation: callable by
  reporter, either party of the NDA, or any address after a second
  `APPEAL_WINDOW_SECONDS` rescue window. This closes the previously
  incomplete path where the non-violator's 17 % compensation share was
  stranded if the reporter never returned.
- **`claim_reporter_reward` becomes an alias** for the same internal logic
  so external callers built against the pre-0.2.18 ABI still work.
- Reason: "complete the appeal and reward call paths" — review item.

#### Payment-conservation invariants
- **New view `get_nda_liabilities(nda_id)`** exposes `active_stakes +
  escrows + party_withdrawables + treasury` as a single number so the
  conservation invariant is queryable from tests and from the UI.
- **New counters** on `get_stats`: `total_appeals_overturned`,
  `total_appeals_upheld`, `total_report_fees_collected`.
- Reason: "add payment-conservation tests" — review item.

### Tests — `tests/test_nda_sentinel.py`

- Added `test_report_rejected_after_nda_expiry`.
- Added `test_non_reporter_party_can_finalize_after_window`.
- Added `test_replay_across_two_verdict_cycles`.
- Added `test_liabilities_invariant_across_lifecycle` (upheld path).
- Added `test_liabilities_invariant_on_overturned_lifecycle` (overturn path).
- Added `test_new_stats_counters_track_appeal_outcomes`.
- Test suite grew from 7 → 14 tests. All green.

### Frontend — wallet layer (R21–R24 compliance)

- **MetaMask is now the primary signer.** `frontend/lib/genlayer.ts` was
  rewritten to expose live-binding `client` / `activeAddress` / `walletMode`
  that flip at runtime when the user connects MetaMask, with the local
  burner kept as a demo-only fallback (labelled as such in the UI).
- **`ensureStudionetChain()`** calls `wallet_switchEthereumChain` and
  auto-registers the network via `wallet_addEthereumChain` on `4902` /
  `-32603` (R23).
- **Chain id read from `studionet.id`** — no hard-coded literal (R23).
- **`ensureCorrectChainBeforeWrite()`** guards every write path.
- **Session restoration** on page load — MetaMask re-attaches silently
  without a new prompt.
- **Reactive UI** — `WALLET_CHANGED_EVENT` dispatched on connect / account
  change so the address chip and per-page dashboards refresh in place.

### Frontend — UX polish

- Every write handler exposes the returned transaction hash with a link to
  `https://genlayer-explorer.vercel.app/tx/…` so reviewers can verify tx
  finality on-chain.
- Wizard shows a copy explaining consensus latency (30 s – 3 min) so a
  hanging spinner is not misread as a bug.
- "Claim Reward" surface renamed to "Finalize Verdict" for non-reporter
  parties, reflecting the relaxed contract auth.

### Docs

- Added `CHANGELOG.md` (this file).
- Added `SECURITY.md` — threat model, escrow invariant, and audit checklist.
- README updated to `v0.2.18` and points to `CHANGELOG.md` for detail.

---

## [0.2.17] — 2026-07-17 — Resubmission — new contract + accounting fixes

- Full-slash-escrow pattern; overturn restores collateral without
  double-counting; reward + compensation atomic.
- Deployed at `0x10562A17a26D02A1591F49F3013D66e1bBCc6F09`.

## [0.2.16] — Earlier — Initial resubmission

- Pinned pragma to `v0.2.16`; initialised all `u256` scalars in `__init__`.

## [0.1.0] — Initial submission

- First cut of NDA Sentinel dApp: contract + wizard + Vercel deploy.
