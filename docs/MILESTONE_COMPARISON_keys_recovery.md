# Immutable comparison — final reviewed version → this Milestone's submitted commit

**Reviewer ask:** _"Provide an immutable comparison from the final version
reviewed for your Project, including its requested fixes, to this Milestone's
submitted commit. We have the repository; this comparison is needed to identify
the new work and check that it has not already been covered."_

Both endpoints are pinned by commit SHA **and** git tree SHA (a content hash of
the whole tree), so the comparison is immutable and verifiable from the
repository you already have.

---

## Endpoints

| | Final reviewed version (baseline) | This Milestone's submitted commit |
|---|---|---|
| Tag | `v0.2.25-reviewed-baseline` | `v0.2.26-keys-recovery` |
| Commit SHA | `043609a` | `4659ee9` |
| Tree SHA | `8d39fd51d71cb91e401d9b0d728fa627767396b0` | `b6a7dbcdb055fed62a93c5f4c5e8b3427981c80d` |
| Marker | v0.2.25 — multi-party (group) NDA + threshold consensus (the last reviewed milestone, including its requested fixes) | v0.2.26 — verified E2EE + AI-attested keys + social recovery |

`4659ee9`'s direct parent **is** `043609a`, so the comparison below is exactly
this Milestone and nothing else.

Reproduce:

```
git diff v0.2.25-reviewed-baseline..v0.2.26-keys-recovery --stat
# commit range: 043609a..4659ee9
```

---

## The new work in this Milestone (`043609a..4659ee9`)

`git diff --stat` → **8 files, +2064 / −112**. The changeset is the verified
E2EE + AI-attested keys + social recovery feature:

| File | New work |
|---|---|
| `contracts/nda_sentinel.py` | +900 lines — AI-Jury (`eq_principle`) **key attestation**, key rotation history, and **social recovery via K-of-N guardian approvals** (events `key_recovery_initiated`, `guardian_approved`, `key_recovery_finalized`, `guardians_updated`; recovery/guardian storage + methods). |
| `frontend/app/keys/recovery/page.tsx` | +434 — **new** page: initiate recovery, guardian approvals, finalize. |
| `frontend/app/keys/history/page.tsx` | +131 — **new** page: key rotation / attestation history. |
| `frontend/app/keys/page.tsx` | +357/−… — attestation + guardian management added to the existing keys page. |
| `docs/ENCRYPTION.md` | +102/−… — attestation + recovery model documented. |
| `frontend/components/EncryptedContextPanel.tsx`, `NDAWizard.tsx` | wired to the attested-key flow. |
| `CHANGELOG.md` | +114 — v0.2.26 entry. |

---

## Not already covered — proof

The two load-bearing pages are **new files, absent at the baseline** `043609a`:

```
git cat-file -e 043609a:frontend/app/keys/recovery/page.tsx   # → missing
git cat-file -e 043609a:frontend/app/keys/history/page.tsx     # → missing
```

The contract's attestation + social-recovery API is **added** in this range (the
diff introduces it with `+` lines only):

```
git diff 043609a..4659ee9 -- contracts/nda_sentinel.py | grep -E '^\+.*(KEY_RECOVERY|GUARDIAN|recovery|attest)'
# +EVENT_KEY_RECOVERY_INITIATED = "key_recovery_initiated"
# +EVENT_GUARDIAN_APPROVED = "guardian_approved"
# +EVENT_KEY_RECOVERY_FINALIZED = "key_recovery_finalized"
# +EVENT_GUARDIANS_UPDATED = "guardians_updated"
# ...
```

The earlier E2EE groundwork (v0.2.22 vault + public-key registry) is only
*extended* here — `keys/page.tsx` and `docs/ENCRYPTION.md` pre-date this
Milestone and are modified, not claimed as new; the **new** capabilities
(AI-Jury key attestation, rotation history, K-of-N guardian social recovery) do
not exist at the baseline. Nothing in this range overlaps the prior milestones
(v0.2.22–v0.2.25), whose work is otherwise untouched.

---

## On-chain footprint

This feature ships inside the single `nda_sentinel.py` contract. The deployed
studionet address current at submission time and its later extension:

| Version | Address (studionet) | In this comparison |
|---|---|---|
| v0.2.26 verified-E2EE + keys + recovery (this Milestone) | shipped in the `StillHere`/NDA-Sentinel core contract line | yes |
| v0.2.29 (later milestone, extends the same contract) | `0xA08c6aDD6e431334A8192fF375F3135d3d1cdB11` | no — separate submission |

No contract change is made by this comparison; it is documentation + immutable
tags only.
