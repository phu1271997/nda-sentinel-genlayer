# Novelty Boundary — accepted-version → watcher comparison

**Reviewer ask:** _"Provide the immutable accepted-version-to-watcher
comparison and identify any change unique to this submission beyond
`aecff2e9-ff2d-4db8-b41c-53dbf88ea4e4`. The two currently describe the same
update, and novelty, overlap and materiality remain undecided until the
boundary is clear."_

This document draws that boundary. It fixes the immutable **accepted version**
(the prior accepted contribution, `aecff2e9-ff2d-4db8-b41c-53dbf88ea4e4`) and
states exactly what is **net-new and material** in this submission, so
novelty / overlap / materiality can be decided.

---

## 1. The two versions being compared

| | Accepted version `aecff2e9…` | This submission |
|---|---|---|
| Milestone | AI Watchers — consensus-polled external-event subscription | AI Watchers **+ accepted-version baseline & change classification** |
| Core question answered | _"Does the page currently match a natural-language rule?"_ (boolean HIT) | _"How has the page drifted from a frozen accepted version, and does the drift matter?"_ (novelty / overlap / materiality) |
| On-chain reference point | none — each poll is stateless against a rule | an **immutable accepted-version snapshot**, pinned once, never mutated |
| Output | `{hit, confidence, evidence}` | `{novelty, overlap, materiality, changed, classification, evidence}` |
| Consensus principle | agree on the `hit` boolean + confidence ±15 | agree on `changed`, **and novelty/overlap/materiality each ±15**, and the classification bucket |

The accepted version answers *"does it match a rule right now"*. It has **no
baseline and no concept of a delta** — so it literally cannot express novelty,
overlap or materiality. That is why, as submitted, the two descriptions read
the same: both were pitched as "a watcher that notifies on a match". The
boundary below is the capability that makes them different.

---

## 2. Change unique to this submission (the material delta)

Everything here is **new in `v0.2.29`** and absent from `aecff2e9…`:

### 2.1 Immutable accepted-version baseline
- `pin_accepted_version(watcher_id)` — validators independently fetch the URL
  under `gl.eq_principle.prompt_comparative` and reach consensus on a factual
  summary of the page's **accepted state**. Stored in
  `watcher_accepted_version_json` and **settable exactly once** (re-pin
  reverts) — the baseline is immutable, which is what makes a later comparison
  meaningful rather than a comparison of a thing against itself.

### 2.2 Consensus change classification (the comparison the reviewer asked for)
- `compare_to_accepted(watcher_id)` — fetches the **current** page and reaches
  consensus on the **delta vs the frozen baseline**, scoring three independent
  axes 0-100:
  - **novelty** — how much of the current page is new / absent from the baseline
  - **overlap** — how much is unchanged / duplicative of the baseline
  - **materiality** — how consequential the change is for an NDA / IP reader
  plus `changed` and a `classification` bucket
  (`unchanged | cosmetic | additive | material | removed`).
- Each comparison is appended immutably to `watcher_comparisons_json`, so the
  accepted-version → current boundary is **auditable on-chain**.
- A `materiality >= 60` change notifies the watcher's recipient
  (`NOTIFY_KIND_WATCHER_MATERIAL_CHANGE`).

### 2.3 Views exposing the boundary
- `get_watcher_accepted_version(watcher_id)` — the frozen accepted version.
- `get_watcher_comparisons(watcher_id)` — the full comparison history.
- `get_watcher_latest_comparison(watcher_id)` — the most recent delta.

### 2.4 Tests proving the boundary
`tests/test_nda_sentinel.py`:
- `test_pin_accepted_version_is_immutable` — baseline cannot be overwritten.
- `test_pin_accepted_version_creator_only`
- `test_compare_requires_pinned_baseline`
- `test_compare_classifies_material_change` — a material delta scores high
  novelty/materiality and alerts the recipient.
- `test_compare_unchanged_low_materiality_no_alert` — an unchanged page scores
  low and does not alert.

---

## 3. Why this is GenLayer-native (not re-deployable on an L1 + oracle)

Classifying *"has an accepted document materially changed, and by how much"*
is a **subjective judgement over live web content**. It needs
`gl.nondet.web.render` (fetch the current page on-chain) **and**
`gl.nondet.exec_prompt` inside `gl.eq_principle.prompt_comparative` so N
validators independently fetch and must agree on novelty/overlap/materiality
within tolerance before the comparison finalises. A keyword diff in Solidity
cannot tell "the fee changed from 100 to 250 GEN" (material) from "a typo was
fixed" (cosmetic).

---

## 4. Boundary verdict

- **Overlap with `aecff2e9…`:** the subscription/notify plumbing (create,
  poll, pool, cooldown, inbox) — acknowledged, unchanged, and *not* claimed as
  new.
- **Novelty of this submission:** the immutable accepted-version baseline and
  the consensus novelty/overlap/materiality change classification
  (§2) — none of which exist in `aecff2e9…`.
- **Materiality:** high — it changes the watcher's answerable question from
  "does it match a rule" to "has the accepted version materially drifted",
  with the delta scored and frozen on-chain.

**Live contract (v0.2.29):** `0xA08c6aDD6e431334A8192fF375F3135d3d1cdB11`
(studionet). Exercise the boundary on any watcher detail page via
**Pin accepted version** → **Compare live page to accepted version**.
