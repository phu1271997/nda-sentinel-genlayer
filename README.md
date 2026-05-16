# NDA Sentinel

## Overview
Traditional NDAs are unenforceable in practice:
- **Cost**: Lawsuits typically cost $200k–$2M in legal fees.
- **Duration**: The average legal process takes 18–36 months.
- **Difficulty**: Discovery is adversarial, cross-jurisdictional NDAs are a nightmare, and damages are hard to quantify.

**NDA Sentinel** is a trustless NDA enforcement dApp built on GenLayer. It uses an AI Jury to detect leaks, with smart contracts that automatically slash violators—no lawsuits, no waiting.

## Architecture
```text
  [ Party A & Party B ]
           |
     (1) Commit Hashes
     (2) Stake GEN
           |
  +-------------------+        (4) Fetch suspect URL
  | NDA Sentinel      | ---------------------------> [ Public Web (X, Github, etc.) ]
  | Smart Contract    | <--------------------------- [ Fetched content ]
  | (GenLayer L2)     | 
  +-------------------+
           |
     (3) Report Leak
     (with Vault Keys)
           |
    [ AI Jury Consensus ] ---> Analyzes content & keywords ---> Slashes violator
```

## Privacy Model
See `docs/PRIVACY_MODEL.md`.

## Economics
See `docs/ECONOMICS.md`.

## Step-by-Step Deploy Guide
STEP 1: Open https://studio.genlayer.com/contracts
STEP 2: New Contract -> paste contracts/nda_sentinel.py
STEP 3: Click Deploy (no constructor args)
STEP 4: WAIT 30-60s. If "Contract Queues not found" or "RevealingPhase not found",
        that's a TRANSIENT consensus error — retry deployment, NOT a code bug
STEP 5: Copy contract address (0x...)
STEP 6: cd "frontend" && cp .env.example .env
STEP 7: Paste address into NEXT_PUBLIC_CONTRACT_ADDRESS
STEP 8: npm install && npm run dev
STEP 9: Open http://localhost:3000, connect MetaMask (add GenLayer Studio network)
STEP 10: Create test NDA between two test wallets you control

## Troubleshooting
```text
ERROR: "module 'genlayer.gl' has no attribute 'contract'"
  → Wrong syntax. Use class X(gl.Contract): not @gl.contract decorator.

ERROR: "TypeError: This class can't be created with TreeMap()" / "AssertionError"
  → Storage initialized in __init__. Remove all such initializations.

ERROR: "Contract Queues not found" / "RevealingPhase not found"
  → Transient Studio consensus error. Retry. Not a code issue.

ERROR: web.render fails on suspect URL
  → Some sites block scrapers (Twitter aggressively rate-limits). Use Nitter mirror
    (nitter.net/{handle}/status/{id}) as fallback for X/Twitter, or archive.org snapshot.

ERROR: AI Jury says "inconclusive" too often
  → Tighten DETECTION PROMPT. Make sure scope+context_description give enough context.
    Or: provide more specific keywords (don't use generic terms).

ERROR: Report transaction stuck >3 min
  → AI consensus pending. Normal. Wait up to 4 min before retrying.
```

## Roadmap
- v2: Multi-party NDAs (3+ signers), continuous monitoring, watchdog reporters.
- v3: Encrypted on-chain keyword storage, cross-chain enforcement via LayerZero.
