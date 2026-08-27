#!/usr/bin/env bash
# Verifies the three Explorer form fields fit their character caps.
# Run from repo root: bash deliverables/count-check.sh
set -euo pipefail
cd "$(dirname "$0")"

one_liner='AI Jury reads the suspect URL on-chain and slashes the leaker atomically — no $200k lawsuit, no 24-month wait.'

description='NDA Sentinel turns a signed paper NDA into an enforceable escrow. Party A commits sha256(keyword + salt) hashes on-chain, both sides stake GEN, and either party can later report a suspect URL. That fires report_leak, which runs gl.vm.run_nondet under eq_principle.prompt_comparative: every validator fetches PRIMARY + WAYBACK + GOOGLE via gl.nondet.web.render, asks its LLM for a JSON verdict, and only converges when the verdict AND sources_confirming count agree. Confirmed leaks split escrow 80/17/3 to reporter / non-violator / treasury. Violators can appeal within 7 days on an enum ground (PRIOR_DISCLOSURE / ATTRIBUTION_ERROR / KEYWORD_MISMATCH) with an evidence URL and timestamp — enforced by the contract, not the LLM. Publisher identities register on-chain via a proof-page fetch. Built for M&A advisors, tech startups, and litigation-settlement counsel: parties whose leaked secret is worth more than 1 GEN and less than $200k of legal spend.'

verification='Open the live URL and go to /violations, then NDA #3. Status shows "leaked"; the verdict panel renders the AI Jury JSON (verdict, confidence, responsible_party, sources_confirming, evidence_quote) plus a lifecycle timeline including leak_reported → violation_confirmed → appeal_filed (ground=KEYWORD_MISMATCH). On the Explorer contract page you see a report_leak transaction with GENVM RESULT: SUCCESS and CONSENSUS RESULT: Accepted — proof the on-chain fetch + consensus ran.'

check() {
    local label=$1 cap=$2 body=$3
    local n
    n=$(printf '%s' "$body" | wc -m | tr -d ' ')
    if [ "$n" -gt "$cap" ]; then
        printf '❌ %-14s %d chars — OVER cap %d\n' "$label" "$n" "$cap"
        exit 1
    fi
    printf '✅ %-14s %d chars (cap %d)\n' "$label" "$n" "$cap"
}

check one_liner 180 "$one_liner"
check description 1000 "$description"
check verification 500 "$verification"
