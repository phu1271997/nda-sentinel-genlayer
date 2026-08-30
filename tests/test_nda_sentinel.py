import datetime
import hashlib
import json
import sys

import pytest


SCOPE = "source_code"
CONTEXT = "Codebase sharing for audit"
STAKE = 100 * 10**18
REPORT_FEE = 1 * 10**18
APPEAL_FEE = STAKE // 10
APPEAL_WINDOW_SECONDS = 7 * 24 * 60 * 60
SALT = "supersecretsalt123"
KEYWORDS = ["secret_algorithm", "private_key_123"]
START = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)


def iso_at(seconds: int) -> str:
    return (START + datetime.timedelta(seconds=seconds)).isoformat().replace("+00:00", "Z")


def warp(direct_vm, seconds: int) -> None:
    timestamp = iso_at(seconds)
    direct_vm.warp(timestamp)
    # genlayer-test 0.29.2 does not refresh message_raw.datetime on warp.
    # Keep the injected transaction context aligned with the VM clock.
    gl_module = sys.modules.get("genlayer.gl")
    if gl_module is not None:
        gl_module.message_raw["datetime"] = timestamp


def keyword_hashes() -> str:
    hashes = [hashlib.sha256((kw + SALT).encode()).hexdigest() for kw in KEYWORDS]
    return json.dumps(hashes)


def as_hex(address) -> str:
    if isinstance(address, bytes):
        return "0x" + address.hex()
    return address.as_hex if hasattr(address, "as_hex") else str(address)


def deploy_active_nda(direct_vm, direct_deploy, party_a, party_b):
    warp(direct_vm, 0)
    direct_vm.sender = party_a
    contract = direct_deploy("contracts/nda_sentinel.py")
    direct_vm.value = STAKE
    nda_id = contract.create_nda(
        as_hex(party_b), SCOPE, CONTEXT, int(START.timestamp()) + 30 * 24 * 60 * 60,
        keyword_hashes(),
    )
    assert int(nda_id) == 0

    direct_vm.sender = party_b
    direct_vm.value = STAKE
    contract.activate_nda(nda_id)
    direct_vm.value = 0
    return contract


def mock_verdict(direct_vm, verdict: str):
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": "secret_algorithm was leaked"})
    direct_vm.mock_llm(
        r".*AI Jury for an NDA enforcement protocol.*",
        json.dumps({
            "verdict": "violation_confirmed",
            "confidence": 95,
            "responsible_party": "party_a",
            "match_score": 95,
            "specificity_score": 90,
            "prior_disclosure_found": False,
            "intent": "intentional",
            "reasoning": "The protected information was disclosed by party A.",
            "evidence_quote": "secret_algorithm was leaked",
            "matched_keywords_count": 1,
        }),
    )
    direct_vm.mock_llm(
        r".*AI Appellate Jury.*",
        json.dumps({"verdict": verdict, "reasoning": f"The prior decision is {verdict}."}),
    )


# v0.2.20 — structured appeal helper. Existing tests only need the ground
# stub for backwards behaviour; PRIOR_DISCLOSURE-specific gates get their
# own dedicated tests below.
DEFAULT_EVIDENCE_URL = "https://example.com/appeal-evidence"


def do_appeal(
    contract,
    nda_id: int = 0,
    ground: str = "ATTRIBUTION_ERROR",
    evidence_url: str = DEFAULT_EVIDENCE_URL,
    evidence_timestamp: int = 0,
    context_notes: str = "Structured appeal from tests.",
):
    contract.appeal(
        nda_id, ground, evidence_url, evidence_timestamp, context_notes,
    )


def report_party_a(direct_vm, contract, reporter):
    direct_vm.sender = reporter
    direct_vm.value = REPORT_FEE
    contract.report_leak(0, "https://example.com/leak", json.dumps([KEYWORDS[0]]), SALT)
    direct_vm.value = 0


def payment_state(contract):
    return json.loads(contract.get_payment_state(0))


def withdrawable(contract, account) -> int:
    nda = contract.get_nda(0)
    key = nda.party_a if as_hex(nda.party_a).lower() == as_hex(account).lower() else nda.party_b
    return int(contract.get_withdrawable(key))


def assert_conserved(total_received: int, *liabilities: int):
    assert sum(liabilities) == total_received


def liabilities(contract, nda_id: int = 0):
    return json.loads(contract.get_nda_liabilities(nda_id))


def assert_liabilities_match(contract, total_received: int, nda_id: int = 0):
    """Sum of active stakes + escrows + party withdrawables + treasury
    must equal every wei ever paid into this NDA's lifecycle."""
    liab = liabilities(contract, nda_id)
    assert int(liab["total_liabilities"]) == total_received, (
        f"conservation broken: expected {total_received}, got {liab}"
    )


def test_create_activate_and_initial_state(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    nda = contract.get_nda(0)
    stats = json.loads(contract.get_stats())

    assert nda.status == "active"
    assert int(nda.stake_a) == STAKE
    assert int(nda.stake_b) == STAKE
    assert int(stats["total_ndas_created"]) == 1
    assert int(stats["treasury"]) == 0


def test_cancel_pending_requires_deadline(direct_vm, direct_deploy, direct_alice, direct_bob):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    direct_vm.value = STAKE
    contract.create_nda(
        as_hex(direct_bob), SCOPE, CONTEXT,
        int(START.timestamp()) + 30 * 24 * 60 * 60, keyword_hashes(),
    )
    direct_vm.value = 0

    with direct_vm.expect_revert("Activation deadline not yet elapsed"):
        contract.cancel_pending_nda(0)

    warp(direct_vm, APPEAL_WINDOW_SECONDS)
    contract.cancel_pending_nda(0)
    nda = contract.get_nda(0)
    assert nda.status == "cancelled"
    assert int(nda.stake_a) == 0
    assert withdrawable(contract, direct_alice) == STAKE


def test_violation_keeps_full_slash_escrowed_and_conserves_payments(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)

    nda = contract.get_nda(0)
    state = payment_state(contract)
    stats = json.loads(contract.get_stats())

    assert nda.status == "leaked"
    assert int(nda.stake_a) == 0
    assert int(state["reporter_reward_escrow"]) == 80 * 10**18
    assert int(state["compensation_escrow"]) == 17 * 10**18
    assert int(state["treasury_fee_escrow"]) == 3 * 10**18
    assert withdrawable(contract, direct_bob) == 0
    assert int(stats["treasury"]) == REPORT_FEE
    assert_conserved(
        2 * STAKE + REPORT_FEE,
        int(nda.stake_b),
        int(nda.slashed_amount),
        int(stats["treasury"]),
    )


def test_overturned_appeal_restores_collateral_without_minting(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    do_appeal(contract, 0, context_notes="This publication predates the NDA and proves prior disclosure.")
    direct_vm.value = 0

    nda = contract.get_nda(0)
    state = payment_state(contract)
    stats = json.loads(contract.get_stats())

    assert nda.status == "active"
    assert int(nda.stake_a) == STAKE
    assert int(nda.stake_b) == STAKE
    assert int(nda.slashed_amount) == 0
    assert withdrawable(contract, direct_alice) == APPEAL_FEE
    assert int(state["reporter_reward_escrow"]) == 0
    assert int(state["compensation_escrow"]) == 0
    assert int(state["treasury_fee_escrow"]) == 0
    assert int(stats["total_violations_confirmed"]) == 0
    assert int(stats["total_value_slashed"]) == 0
    assert_conserved(
        2 * STAKE + REPORT_FEE + APPEAL_FEE,
        int(nda.stake_a), int(nda.stake_b),
        withdrawable(contract, direct_alice),
        int(stats["treasury"]),
    )


def test_upheld_appeal_and_reward_path_conserve_every_payment(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    do_appeal(contract, 0, context_notes="The attribution should be reviewed again.")
    direct_vm.value = 0

    direct_vm.sender = direct_bob
    contract.claim_reporter_reward(0)

    nda = contract.get_nda(0)
    state = payment_state(contract)
    stats = json.loads(contract.get_stats())
    reporter_balance = withdrawable(contract, direct_bob)

    assert reporter_balance == 97 * 10**18
    assert int(state["reporter_reward_escrow"]) == 0
    assert int(state["compensation_escrow"]) == 0
    assert int(state["treasury_fee_escrow"]) == 0
    assert int(stats["treasury"]) == REPORT_FEE + APPEAL_FEE + 3 * 10**18
    assert_conserved(
        2 * STAKE + REPORT_FEE + APPEAL_FEE,
        int(nda.stake_b), reporter_balance, int(stats["treasury"]),
    )


def test_deadline_and_replay_protections(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)

    with direct_vm.expect_revert("Appeal window not yet elapsed"):
        direct_vm.sender = direct_bob
        contract.claim_reporter_reward(0)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    do_appeal(contract, 0, context_notes="Review the attribution evidence.")

    with direct_vm.expect_revert("Appeal already submitted for this verdict"):
        do_appeal(contract, 0, context_notes="Replay the same appeal.")


def test_late_appeal_rejected_and_reward_claimable_at_boundary(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)
    warp(direct_vm, APPEAL_WINDOW_SECONDS)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    with direct_vm.expect_revert("Appeal window has elapsed"):
        do_appeal(contract, 0, context_notes="This appeal is too late.")

    direct_vm.sender = direct_bob
    direct_vm.value = 0
    contract.claim_reporter_reward(0)
    assert withdrawable(contract, direct_bob) == 97 * 10**18


def test_reward_cannot_be_claimed_twice(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)
    warp(direct_vm, APPEAL_WINDOW_SECONDS)
    direct_vm.sender = direct_bob
    contract.claim_reporter_reward(0)

    with direct_vm.expect_revert("No escrowed reward"):
        contract.claim_reporter_reward(0)


# ---------------------------------------------------------------------------
# Additional coverage — deadline, replay, non-reporter finalize, invariant.
# Added to close the gaps raised in the resubmission review.
# ---------------------------------------------------------------------------


def test_report_rejected_after_nda_expiry(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    # Jump past the 30-day expiry set by deploy_active_nda().
    warp(direct_vm, 31 * 24 * 60 * 60)

    direct_vm.sender = direct_bob
    direct_vm.value = REPORT_FEE
    with direct_vm.expect_revert("NDA has expired"):
        contract.report_leak(
            0, "https://example.com/leak", json.dumps([KEYWORDS[0]]), SALT,
        )


def test_non_reporter_party_can_finalize_after_window(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    """Reporter absent → non-violator party (party_b in this case is reporter,
    so the finalizer here is the reporter's counterpart, party_a's other side).
    Here we prove any authorised party can settle: appellant already lost, so
    finalize is called by direct_alice (the violator) after the appeal window,
    unblocking the compensation share for the reporter's counterpart."""
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)
    warp(direct_vm, APPEAL_WINDOW_SECONDS)

    # direct_alice is the violator — she still counts as authorised.
    direct_vm.sender = direct_alice
    contract.finalize_verdict(0)

    reporter_balance = withdrawable(contract, direct_bob)
    assert reporter_balance == 97 * 10**18

    state = payment_state(contract)
    assert int(state["reporter_reward_escrow"]) == 0
    assert int(state["compensation_escrow"]) == 0
    assert int(state["treasury_fee_escrow"]) == 0


def test_replay_across_two_verdict_cycles(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Overturned verdict must not permanently lock out future appeals on the
    same NDA. Cycle 1: report → overturned. Cycle 2: report again → violator
    must still be able to appeal (appeal_submitted was reset)."""
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)

    # Cycle 1: overturned.
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)
    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    do_appeal(contract, 0, context_notes="Prior disclosure proves this was public earlier.")
    direct_vm.value = 0

    nda_after_cycle1 = contract.get_nda(0)
    assert nda_after_cycle1.status == "active"
    assert nda_after_cycle1.suspect_url == ""
    assert nda_after_cycle1.verdict_json == ""

    # Cycle 2: report again on the now-active NDA and appeal it a second time.
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    # The replay guard from cycle 1 must have been cleared — this call must
    # NOT revert with "Appeal already submitted for this verdict".
    do_appeal(contract, 0, context_notes="Try appealing the fresh accusation.")
    direct_vm.value = 0

    stats = json.loads(contract.get_stats())
    assert int(stats["total_appeals_overturned"]) == 1
    assert int(stats["total_appeals_upheld"]) == 1


def test_liabilities_invariant_across_lifecycle(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Every wei paid into the NDA must equal active stakes + escrows +
    party withdrawables + treasury, at every step."""
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)

    # After activation only stakes have been received.
    assert_liabilities_match(contract, 2 * STAKE)

    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)
    # Report fee added to intake; slash redistributed but total preserved.
    assert_liabilities_match(contract, 2 * STAKE + REPORT_FEE)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    do_appeal(contract, 0, context_notes="Please review the attribution once more.")
    direct_vm.value = 0
    assert_liabilities_match(contract, 2 * STAKE + REPORT_FEE + APPEAL_FEE)

    direct_vm.sender = direct_bob
    contract.finalize_verdict(0)
    assert_liabilities_match(contract, 2 * STAKE + REPORT_FEE + APPEAL_FEE)


def test_liabilities_invariant_on_overturned_lifecycle(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    assert_liabilities_match(contract, 2 * STAKE)

    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)
    assert_liabilities_match(contract, 2 * STAKE + REPORT_FEE)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    do_appeal(contract, 0, context_notes="Counter-evidence attached.")
    direct_vm.value = 0
    # On overturn: appeal fee refunded to appellant as withdrawable; report
    # fee stayed in treasury; stakes restored.
    assert_liabilities_match(contract, 2 * STAKE + REPORT_FEE + APPEAL_FEE)


def test_new_stats_counters_track_appeal_outcomes(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)
    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    do_appeal(contract, 0, context_notes="Overturn me.")
    direct_vm.value = 0

    stats = json.loads(contract.get_stats())
    assert int(stats["total_appeals_overturned"]) == 1
    assert int(stats["total_appeals_upheld"]) == 0
    assert int(stats["total_report_fees_collected"]) == REPORT_FEE
    # Overturn must roll back the confirmed-violation counter to zero.
    assert int(stats["total_violations_confirmed"]) == 0
    assert int(stats["total_value_slashed"]) == 0


# ---------------------------------------------------------------------------
# Reputation system tests (v0.2.19 — Milestone A).
# Baseline is 1000; confirmed-report gain is +50, confirmed-violation loss
# is -100. See REP_* constants in the contract for the source of truth.
# ---------------------------------------------------------------------------


REP_BASELINE = 1000


def reputation(contract, account) -> dict:
    return json.loads(contract.get_reputation(account))


def test_reputation_baseline_before_any_activity(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    alice_rep = reputation(contract, direct_alice)
    bob_rep = reputation(contract, direct_bob)
    assert int(alice_rep["score"]) == REP_BASELINE
    assert alice_rep["tier"] == "newcomer"
    assert int(bob_rep["score"]) == REP_BASELINE
    assert int(bob_rep["reports_submitted"]) == 0


def test_reputation_reward_on_confirmed_report_and_penalty_on_violation(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)

    reporter = reputation(contract, direct_bob)
    violator = reputation(contract, direct_alice)

    # Reporter earned +50 for a confirmed report.
    assert int(reporter["score"]) == REP_BASELINE + 50
    assert int(reporter["reports_submitted"]) == 1
    assert int(reporter["reports_confirmed"]) == 1
    # Violator took -100 for a confirmed violation.
    assert int(violator["score"]) == REP_BASELINE - 100
    assert violator["tier"] == "newcomer"  # 900 still >= 800 (flagged)
    assert int(violator["violations_confirmed"]) == 1


def test_reputation_rollback_and_penalty_on_overturn(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)
    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    do_appeal(contract, 0, context_notes="Overturn evidence.")
    direct_vm.value = 0

    reporter = reputation(contract, direct_bob)
    appellant = reputation(contract, direct_alice)

    # Reporter: undo +50 gain from confirmation, then -75 for false report.
    # Net delta from baseline: -75.
    assert int(reporter["score"]) == REP_BASELINE - 75
    assert int(reporter["false_reports"]) == 1
    assert int(reporter["reports_confirmed"]) == 0  # counter rolled back
    # Appellant proven innocent: +100 win, undo -100 violation. Net +100.
    assert int(appellant["score"]) == REP_BASELINE + 100
    assert appellant["tier"] == "trusted"  # >= 1050
    assert int(appellant["appeals_won"]) == 1
    assert int(appellant["violations_confirmed"]) == 0  # rolled back


def test_reputation_tier_thresholds_via_thresholds_view(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    thresholds = json.loads(contract.get_reputation_thresholds())
    assert int(thresholds["baseline"]) == REP_BASELINE
    assert int(thresholds["verified_at"]) == 1200
    assert int(thresholds["trusted_at"]) == 1050
    assert int(thresholds["flagged_below"]) == 800


def test_event_log_appended_across_full_lifecycle(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Every state transition of a full lifecycle (create → activate →
    report → appeal → finalize) must append exactly one event, in order."""
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    # Two events so far: nda_created, nda_activated
    assert int(contract.get_events_count()) == 2

    mock_verdict(direct_vm, "upheld")
    report_party_a(direct_vm, contract, direct_bob)
    # leak_reported + violation_confirmed
    assert int(contract.get_events_count()) == 4

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    do_appeal(contract, 0, context_notes="Test the appeal-filed and appeal-upheld emits.")
    direct_vm.value = 0
    # appeal_filed + appeal_upheld
    assert int(contract.get_events_count()) == 6

    direct_vm.sender = direct_bob
    contract.claim_reporter_reward(0)
    # verdict_finalized
    assert int(contract.get_events_count()) == 7

    events = json.loads(contract.get_events(0, 100))
    kinds = [e["kind"] for e in events]
    assert kinds == [
        "nda_created",
        "nda_activated",
        "leak_reported",
        "violation_confirmed",
        "appeal_filed",
        "appeal_upheld",
        "verdict_finalized",
    ]
    # Meta parses cleanly and carries slash amount on violation_confirmed.
    slash_event = events[3]
    slash_meta = json.loads(slash_event["meta_json"])
    assert int(slash_meta["slashed"]) == STAKE


def test_events_by_nda_returns_only_that_nda_events(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    events = json.loads(contract.get_events_for_nda(0))
    kinds = [e["kind"] for e in events]
    assert "nda_created" in kinds
    assert "nda_activated" in kinds


def test_event_pagination_slice_bounds(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    # Only 2 events; asking for events past the tail returns [].
    tail = json.loads(contract.get_events(10, 5))
    assert tail == []
    # First 1 event only.
    slice1 = json.loads(contract.get_events(0, 1))
    assert len(slice1) == 1
    assert slice1[0]["kind"] == "nda_created"


def test_reputation_never_underflows_below_zero(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Repeated hits on the same violator must clamp at 0, never wrap."""
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "upheld")

    # One confirmed report drops alice by 100. 11 rounds would take her
    # 100 points below zero on a naive u256 subtract, so ensure the clamp
    # holds. We stop after the score reaches zero.
    for _ in range(11):
        # New NDA each loop — cheap, and avoids status-transition issues.
        direct_vm.sender = direct_alice
        direct_vm.value = STAKE
        nda_id = contract.create_nda(
            as_hex(direct_bob), SCOPE, CONTEXT,
            int(START.timestamp()) + 30 * 24 * 60 * 60, keyword_hashes(),
        )
        direct_vm.sender = direct_bob
        direct_vm.value = STAKE
        contract.activate_nda(nda_id)
        direct_vm.value = 0
        direct_vm.sender = direct_bob
        direct_vm.value = REPORT_FEE
        try:
            contract.report_leak(
                int(nda_id), "https://example.com/leak", json.dumps([KEYWORDS[0]]), SALT,
            )
        except Exception:
            pass
        direct_vm.value = 0

    alice_rep = reputation(contract, direct_alice)
    assert int(alice_rep["score"]) == 0
    assert alice_rep["tier"] == "flagged"


# ---------------------------------------------------------------------------
# v0.2.20 — reviewer-requested tests
# ---------------------------------------------------------------------------
# 1. Prove that the real web fetch executes INSIDE the eq_principle flow
#    (reviewer: "add a focused test showing the real fetch executes within
#    the equivalence-principle flow").
# 2. Publisher identity registration — happy path + failure path (reviewer:
#    "authenticate publisher identity").
# 3. Structured appeal — enum gate, timestamp gate, evidence-URL fetch
#    (reviewer: "make appeal evidence contract-verifiable rather than
#    free-form prose").
# ---------------------------------------------------------------------------


DISTINCTIVE_PRIMARY_BODY = "MARKER_PRIMARY_ec6f7a9b_leak_of_secret_algorithm"


def test_web_render_executes_inside_equivalence_principle_flow(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    """Reviewer-focused test.

    Installs a WEB mock with a distinctive marker string as the body of
    the PRIMARY suspect URL, then wires the LLM mock to REFUSE unless
    that exact marker is present in the prompt it receives. If the
    `gl.nondet.web.render` call did not actually fire inside the
    equivalence-principle closure — or if its result was not threaded
    into the LLM prompt — the LLM mock returns `no_violation` and the
    NDA never transitions to `leaked`.
    """
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    direct_vm.clear_mocks()

    # PRIMARY suspect URL returns the distinctive body; other fetches
    # (wayback, google) fall back to a neutral body.
    direct_vm.mock_web(
        r"https://example\.com/real-leak",
        {"status": 200, "body": DISTINCTIVE_PRIMARY_BODY},
    )
    direct_vm.mock_web(r".*", {"status": 200, "body": "unrelated corroborating content"})

    # Only respond `violation_confirmed` if the prompt actually contains
    # the distinctive marker — i.e. the primary fetch really happened
    # and was passed into the LLM call.
    direct_vm.mock_llm(
        rf".*{DISTINCTIVE_PRIMARY_BODY}.*",
        json.dumps({
            "verdict": "violation_confirmed",
            "confidence": 90,
            "responsible_party": "party_a",
            "match_score": 92,
            "specificity_score": 88,
            "prior_disclosure_found": False,
            "intent": "intentional",
            "reasoning": "Marker was present in the fetched primary body.",
            "evidence_quote": DISTINCTIVE_PRIMARY_BODY,
            "matched_keywords_count": 1,
            "sources_evaluated": 3,
            "sources_confirming": 1,
            "cross_reference_notes": "primary-only",
        }),
    )
    # Catch-all guardrail: any prompt WITHOUT the marker must return a
    # non-violation, so the test fails loudly if the fetch didn't wire in.
    direct_vm.mock_llm(
        r".*AI Jury for an NDA enforcement protocol.*",
        json.dumps({
            "verdict": "no_violation",
            "confidence": 5,
            "responsible_party": "unknown",
            "match_score": 0,
            "specificity_score": 0,
            "prior_disclosure_found": False,
            "intent": "unknown",
            "reasoning": "Marker missing — the fetch never ran or wasn't wired in.",
            "evidence_quote": "",
            "matched_keywords_count": 0,
            "sources_evaluated": 0,
            "sources_confirming": 0,
            "cross_reference_notes": "no-marker",
        }),
    )

    direct_vm.sender = direct_bob
    direct_vm.value = REPORT_FEE
    contract.report_leak(
        0,
        "https://example.com/real-leak",
        json.dumps([KEYWORDS[0]]),
        SALT,
    )
    direct_vm.value = 0

    nda = contract.get_nda(0)
    assert nda.status == "leaked", (
        f"Expected 'leaked' (would only be set if the marker-bearing prompt "
        f"reached the LLM, proving the fetch fired inside eq_principle). "
        f"Got status={nda.status}"
    )
    assert nda.suspect_url == "https://example.com/real-leak"
    # verdict_json must contain the marker as evidence_quote — direct
    # proof that the fetched body flowed through consensus into storage.
    verdict = json.loads(nda.verdict_json)
    assert DISTINCTIVE_PRIMARY_BODY in verdict.get("evidence_quote", "")


# ---------- Publisher identity ----------


def mock_identity(direct_vm, verified: bool):
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": "identity page body"})
    direct_vm.mock_llm(
        r".*verify out-of-band publisher identity.*",
        json.dumps({
            "verified": verified,
            "handle_seen": verified,
            "address_seen": verified,
            "reasoning": "mock",
        }),
    )


def test_register_publisher_identity_persists_on_confirmed_proof(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_identity(direct_vm, verified=True)

    direct_vm.sender = direct_alice
    contract.register_publisher_identity(
        "@alice_handle", "https://alice.example.com/proof",
    )

    ident = json.loads(contract.get_publisher_identity(direct_alice))
    assert ident["handle"] == "@alice_handle"
    assert ident["proof_url"] == "https://alice.example.com/proof"
    assert int(ident["verified_at"]) > 0


def test_register_publisher_identity_rejects_when_proof_fails(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_identity(direct_vm, verified=False)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("identity verification failed"):
        contract.register_publisher_identity(
            "@alice_handle", "https://alice.example.com/proof",
        )

    ident = json.loads(contract.get_publisher_identity(direct_alice))
    assert ident["handle"] == ""


def test_register_publisher_identity_rejects_malformed_url(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("proof_url must be http:// or https://"):
        contract.register_publisher_identity(
            "@alice_handle", "ftp://alice.example.com/proof",
        )


# ---------- Contract-verifiable appeal ----------


def test_appeal_rejects_unknown_ground(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    with direct_vm.expect_revert("appeal_ground must be one of"):
        contract.appeal(
            0,
            "MADE_UP_GROUND",
            "https://example.com/x",
            0,
            "notes",
        )


def test_appeal_prior_disclosure_rejects_timestamp_after_nda_created(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    # NDA was created at START (2026-01-01). A claimed evidence timestamp
    # AFTER that must be rejected — the contract, not the LLM, enforces.
    late = int(START.timestamp()) + 60
    with direct_vm.expect_revert(
        "PRIOR_DISCLOSURE evidence_timestamp must be strictly before nda.created_at",
    ):
        contract.appeal(
            0,
            "PRIOR_DISCLOSURE",
            "https://example.com/older",
            late,
            "notes",
        )


def test_appeal_prior_disclosure_requires_nonzero_timestamp(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    with direct_vm.expect_revert(
        "PRIOR_DISCLOSURE requires a non-zero evidence_timestamp",
    ):
        contract.appeal(
            0,
            "PRIOR_DISCLOSURE",
            "https://example.com/older",
            0,
            "notes",
        )


def test_appeal_prior_disclosure_accepts_pre_nda_timestamp_and_persists(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    prior = int(START.timestamp()) - 24 * 60 * 60  # 1 day before NDA
    contract.appeal(
        0,
        "PRIOR_DISCLOSURE",
        "https://example.com/older",
        prior,
        "The article predates the NDA by one day.",
    )
    direct_vm.value = 0

    ap = contract.get_appeal(0)
    assert ap.appeal_ground == "PRIOR_DISCLOSURE"
    assert ap.evidence_url == "https://example.com/older"
    assert int(ap.evidence_timestamp) == prior
    # counter_evidence storage now carries the machine-readable JSON blob
    stored = json.loads(ap.counter_evidence)
    assert stored["appeal_ground"] == "PRIOR_DISCLOSURE"
    assert stored["evidence_timestamp"] == prior


def test_appeal_rejects_non_http_evidence_url(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    mock_verdict(direct_vm, "overturned")
    report_party_a(direct_vm, contract, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = APPEAL_FEE
    with direct_vm.expect_revert("evidence_url must be http:// or https://"):
        contract.appeal(
            0,
            "ATTRIBUTION_ERROR",
            "ftp://example.com/x",
            0,
            "notes",
        )


def test_appeal_grounds_view_lists_all_enum_values(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    grounds = json.loads(contract.get_appeal_grounds())
    assert set(grounds) == {"PRIOR_DISCLOSURE", "ATTRIBUTION_ERROR", "KEYWORD_MISMATCH"}


# --- Fast smoke tests (added 2026-08-27) ------------------------------------
#
# These deploy a fresh contract but never trigger nondet consensus, so they
# stay under ~1s each and belong in the `fast` bucket. They pin the shape of
# the read-only surface the frontend consumes so a schema regression fails
# the test suite before it ever fails the dashboard.

def test_stats_view_zeroed_on_fresh_deploy(direct_vm, direct_deploy, direct_alice):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    stats = json.loads(contract.get_stats())
    for key in (
        "total_ndas_created",
        "total_violations_confirmed",
        "total_value_slashed",
        "total_appeals_overturned",
        "total_appeals_upheld",
        "total_report_fees_collected",
        "treasury",
    ):
        assert stats[key] in ("0", 0), f"expected zero for {key}, got {stats[key]!r}"


def test_reputation_thresholds_expose_config_constants(
    direct_vm, direct_deploy, direct_alice,
):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    thresholds = json.loads(contract.get_reputation_thresholds())
    assert thresholds["baseline"] == 1000
    assert thresholds["verified"] == 1200
    assert thresholds["trusted"] == 1050
    assert thresholds["flagged"] == 800


def test_events_view_empty_on_fresh_deploy(direct_vm, direct_deploy, direct_alice):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    assert int(contract.get_events_count()) == 0
    assert json.loads(contract.get_events(0, 10)) == []


def test_events_for_nda_empty_for_unknown_id(direct_vm, direct_deploy, direct_alice):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    assert json.loads(contract.get_events_for_nda(999)) == []


def test_publisher_identity_view_empty_before_registration(
    direct_vm, direct_deploy, direct_alice,
):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    from genlayer import Address
    result = contract.get_publisher_identity(Address(as_hex(direct_alice)))
    # Empty means "no registered handle yet" — the wizard renders this as
    # the "Register identity" CTA rather than a green checkmark.
    assert result in ("", None)


# --- Security hardening v0.2.21 tests ----------------------------------------

def test_create_nda_rejects_duplicate_keyword_hashes(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    dup_hash = hashlib.sha256(("kw1" + SALT).encode()).hexdigest()
    dup_hashes = json.dumps([dup_hash, dup_hash])
    direct_vm.value = STAKE
    with pytest.raises(Exception, match="Duplicate keyword hashes"):
        contract.create_nda(
            as_hex(direct_bob), SCOPE, CONTEXT,
            int(START.timestamp()) + 30 * 24 * 60 * 60, dup_hashes,
        )


def test_create_nda_rejects_non_hex_keyword_hash(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    bad_hash = "g" * 64
    direct_vm.value = STAKE
    with pytest.raises(Exception, match="hex characters"):
        contract.create_nda(
            as_hex(direct_bob), SCOPE, CONTEXT,
            int(START.timestamp()) + 30 * 24 * 60 * 60, json.dumps([bad_hash]),
        )


def test_create_nda_rejects_dust_stake(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    direct_vm.value = 1
    with pytest.raises(Exception, match="at least"):
        contract.create_nda(
            as_hex(direct_bob), SCOPE, CONTEXT,
            int(START.timestamp()) + 30 * 24 * 60 * 60, keyword_hashes(),
        )


def test_activate_nda_rejects_dust_stake(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    direct_vm.value = STAKE
    nda_id = contract.create_nda(
        as_hex(direct_bob), SCOPE, CONTEXT,
        int(START.timestamp()) + 30 * 24 * 60 * 60, keyword_hashes(),
    )
    direct_vm.sender = direct_bob
    direct_vm.value = 1
    with pytest.raises(Exception, match="at least"):
        contract.activate_nda(nda_id)


def test_report_leak_rejects_non_http_url(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    direct_vm.value = REPORT_FEE
    with pytest.raises(Exception, match="http:// or https://"):
        contract.report_leak(
            0, "ftp://example.com/leak", json.dumps([KEYWORDS[0]]), SALT,
        )


def test_report_leak_rejects_overlong_url(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    contract = deploy_active_nda(direct_vm, direct_deploy, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    direct_vm.value = REPORT_FEE
    long_url = "https://example.com/" + "a" * 2100
    with pytest.raises(Exception, match="exceeds"):
        contract.report_leak(0, long_url, json.dumps([KEYWORDS[0]]), SALT)


def test_get_nda_count_tracks_creation(
    direct_vm, direct_deploy, direct_alice, direct_bob,
):
    warp(direct_vm, 0)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/nda_sentinel.py")
    assert int(contract.get_nda_count()) == 0
    direct_vm.value = STAKE
    contract.create_nda(
        as_hex(direct_bob), SCOPE, CONTEXT,
        int(START.timestamp()) + 30 * 24 * 60 * 60, keyword_hashes(),
    )
    assert int(contract.get_nda_count()) == 1
