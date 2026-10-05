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
| Tag | `v0.2.27-reviewed-baseline` | `v0.2.28-ai-watchers` |
| Commit SHA | `8bf1d01` | `b181d80` |
| Tree SHA | `08d720d2f1954fe8a49fd9fb2457a14f7af486f9` | `f9f12b8313362662a68844ca374b6b825a931379` |
| Marker | v0.2.27 — AI-adjudicated bounty board + endorsement web (the last reviewed milestone, including its requested fixes) | v0.2.28 — AI Watchers (consensus-verified external event subscriptions) |

`b181d80`'s direct parent **is** `8bf1d01`, so the comparison below is exactly
the AI Watchers milestone and nothing else.

Reproduce:

```
git diff v0.2.27-reviewed-baseline..v0.2.28-ai-watchers --stat
# commit range: 8bf1d01..b181d80
```

---

## The new work in this Milestone (`8bf1d01..b181d80`)

`git diff --stat` → **6 files, +1557 / −2**. The entire changeset is the AI
Watchers feature:

| File | New work |
|---|---|
| `contracts/nda_sentinel.py` | +576 lines — the `Watcher` dataclass + `create_watcher`, `poll_watcher`, `top_up_watcher`, `pause_watcher` / `resume_watcher`, `cancel_watcher` and the watcher views. A watcher polls a public URL under `gl.eq_principle` consensus and pays the poller from a reward pool on a consensus HIT. |
| `frontend/app/watchers/page.tsx` | +229 — watcher list / open-watchers board (new file). |
| `frontend/app/watchers/new/page.tsx` | +214 — create-a-watcher form (new file). |
| `frontend/app/watchers/[watcherId]/page.tsx` | +447 — watcher detail: poll, top-up, pause/resume/cancel, hit history (new file). |
| `frontend/components/SiteHeader.tsx` | +3/−1 — nav link to the watchers section. |
| `CHANGELOG.md` | +90 — v0.2.28 entry. |

---

## Not already covered — proof

The three watcher pages are **new files, absent at the baseline** `8bf1d01`:

```
git cat-file -e 8bf1d01:frontend/app/watchers/page.tsx                 # → missing
git cat-file -e 8bf1d01:frontend/app/watchers/new/page.tsx             # → missing
git cat-file -e '8bf1d01:frontend/app/watchers/[watcherId]/page.tsx'   # → missing
```

The contract watcher API is **added** in this range (it does not exist at the
baseline) — the diff introduces it with `+` lines only:

```
git diff 8bf1d01..b181d80 -- contracts/nda_sentinel.py | grep -E '^\+.*(class Watcher|def create_watcher|def poll_watcher)'
# +class Watcher:
# +    def create_watcher(
# +    def poll_watcher(self, watcher_id: u256) -> None:
```

Everything in this Milestone is therefore new relative to the last reviewed
version and does not overlap the prior milestones (v0.2.22–v0.2.27), whose work
(E2EE vault, badges/leaderboard, notification inbox, group NDA, bounty board +
endorsements) is untouched by this range.

---

## On-chain footprint

The AI Watchers contract was deployed to studionet with this milestone. (A later,
separate milestone — v0.2.29, accepted-version baseline + change classification —
extended the same contract; it is **not** part of this comparison range.)

| Version | Address (studionet) | In this comparison |
|---|---|---|
| v0.2.28 — AI Watchers (this Milestone) | `0x5502CF942A92a7FCB0F51169e529D47Ad53aBDD0` | yes |
| v0.2.29 — accepted-version baseline (later milestone) | `0xA08c6aDD6e431334A8192fF375F3135d3d1cdB11` | no — separate submission |
