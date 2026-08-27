# NDA Sentinel Test Suite

Runs against a real GenLayer runtime via
[`genlayer-test`](https://pypi.org/project/genlayer-test/). Every test
deploys a fresh contract, installs a bare-dict `sim_installMocks` fixture
(see rule R17 in `~GEN_RULES/02-common-errors.md`), and drives the full
lifecycle via `direct_vm.sender = <address>` + `contract.<method>(...)`.

## Running

```bash
pip install genlayer-test
```

**Full run** (default — all fast + slow tests):

```bash
gltest
```

**Fast only** (single-transition guards, sub-second each):

```bash
gltest -m fast
```

**Slow only** (multi-cycle payment/reputation/event invariants):

```bash
gltest -m slow
```

**Against studionet instead of localnet** (slower, but exercises the real
consensus path):

```bash
gltest --network studionet
```

## Tag map

Markers are applied automatically by `tests/conftest.py`. To move a test
between buckets, edit the `SLOW_TESTS` set in that file — no need to
touch the test body.

| Marker | Purpose |
|---|---|
| `fast` | Guard / rejection / boundary tests. Default bucket. |
| `slow` | Full-lifecycle tests that walk report → verdict → appeal → finalize → withdraw and check the payment-conservation invariant end-to-end. |

## Fixtures & helpers

- `deploy_active_nda(...)` — deploys a fresh contract and returns an
  already-activated NDA between Alice and Bob at stake `100 GEN`.
- `mock_verdict(direct_vm, verdict)` — installs an LLM mock that returns
  the given JSON verdict shape for every nondet prompt.
- `do_appeal(...)` — files a structured appeal with a specific ground +
  evidence URL + timestamp.
- `warp(direct_vm, seconds)` — advances both the VM clock and
  `gl.message_raw.datetime` (workaround for genlayer-test 0.29.2).
- `assert_liabilities_match(contract, total_received, nda_id)` —
  invariant check: escrows + active stakes + party withdrawables +
  treasury = total value the contract received.
