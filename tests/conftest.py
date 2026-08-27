"""
Test suite configuration for NDA Sentinel.

Registers markers so `gltest -m fast` (or `pytest -m fast`) filters to the
sub-second happy-path & guard tests, and `-m slow` runs the
lifecycle / two-cycle / event-log tests separately.

Any test **not** explicitly marked is treated as fast — that keeps the
default `gltest` run comprehensive without needing to re-tag existing
tests. See tests/README.md for the tag map.
"""

import pytest

SLOW_TESTS = {
    # Full-cycle payment invariants
    "test_liabilities_invariant_across_lifecycle",
    "test_liabilities_invariant_on_overturned_lifecycle",
    "test_upheld_appeal_and_reward_path_conserve_every_payment",
    "test_overturned_appeal_restores_collateral_without_minting",
    "test_violation_keeps_full_slash_escrowed_and_conserves_payments",
    "test_non_reporter_party_can_finalize_after_window",
    "test_replay_across_two_verdict_cycles",
    "test_event_log_appended_across_full_lifecycle",
    "test_reputation_reward_on_confirmed_report_and_penalty_on_violation",
    "test_reputation_rollback_and_penalty_on_overturn",
    "test_web_render_executes_inside_equivalence_principle_flow",
}


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "fast: quick single-transition tests — expected to run in under a second each.",
    )
    config.addinivalue_line(
        "markers",
        "slow: multi-cycle lifecycle / invariant tests — several seconds each on studionet.",
    )


def pytest_collection_modifyitems(config, items):
    for item in items:
        if item.name in SLOW_TESTS:
            item.add_marker(pytest.mark.slow)
        else:
            item.add_marker(pytest.mark.fast)
