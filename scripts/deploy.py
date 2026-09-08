#!/usr/bin/env python3
"""Deploy NDA Sentinel contract to studionet.

Usage:
    source ~/.genlayer/env.sh
    python3 scripts/deploy.py --chain studionet

Reads GENLAYER_PRIVATE_KEY from env (loaded by ~/.genlayer/env.sh).
Prints the deployed contract address and updates
deployment/deployed_addresses.json in-place.
"""

import argparse
import json
import os
import pathlib
import sys
import time

REPO = pathlib.Path(__file__).resolve().parent.parent
CONTRACT_PATH = REPO / "contracts" / "nda_sentinel.py"
DEPLOYMENTS_PATH = REPO / "deployment" / "deployed_addresses.json"


def _fatal(msg: str) -> None:
    print(f"[deploy] FATAL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--chain", default="studionet", choices=["studionet", "testnet_asimov", "testnet_bradbury"])
    p.add_argument("--version", default=None, help="Version string to record (default: parsed from contract header)")
    p.add_argument("--notes", default="", help="Notes to write into deployed_addresses.json")
    p.add_argument("--dry-run", action="store_true", help="Do not send, just print what would happen")
    args = p.parse_args()

    pk = os.environ.get("GENLAYER_PRIVATE_KEY")
    if not pk:
        _fatal("GENLAYER_PRIVATE_KEY not set. Run: source ~/.genlayer/env.sh")

    if not CONTRACT_PATH.exists():
        _fatal(f"contract missing: {CONTRACT_PATH}")
    contract_code = CONTRACT_PATH.read_text()

    version = args.version
    if version is None:
        first_line = contract_code.splitlines()[0].strip()
        if first_line.startswith("#"):
            version = first_line.lstrip("# ").strip()
        else:
            version = "unknown"

    from genlayer_py import create_account, create_client
    from genlayer_py import studionet, testnet_asimov, testnet_bradbury

    chains = {
        "studionet": studionet,
        "testnet_asimov": testnet_asimov,
        "testnet_bradbury": testnet_bradbury,
    }
    chain = chains[args.chain]
    acct = create_account(pk)
    client = create_client(chain=chain, account=acct)

    print(f"[deploy] chain     = {args.chain}")
    print(f"[deploy] version   = {version}")
    print(f"[deploy] deployer  = {acct.address}")
    print(f"[deploy] contract  = {CONTRACT_PATH.name} ({len(contract_code)} bytes)")

    balance = client.get_balance(acct.address)
    print(f"[deploy] balance   = {balance} wei")
    if int(balance) == 0:
        print(f"[deploy] WARNING: deployer has 0 balance on {args.chain}. Fund from a faucet or transfer first.", file=sys.stderr)

    if args.dry_run:
        print("[deploy] dry-run: not sending.")
        return

    print("[deploy] submitting deploy tx …")
    tx_hash = client.deploy_contract(code=contract_code)
    print(f"[deploy] tx hash   = {tx_hash}")

    print("[deploy] waiting for ACCEPTED status …")
    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_hash,
        status="ACCEPTED",
        retries=120,
        interval=3000,
    )

    contract_address = None
    try:
        contract_address = receipt.get("data", {}).get("contract_address")
    except AttributeError:
        contract_address = getattr(receipt, "data", {}).get("contract_address") if hasattr(receipt, "data") else None
    if not contract_address:
        # Fallback: inspect receipt fully.
        contract_address = (
            (receipt.get("contract_address") if isinstance(receipt, dict) else None)
            or (receipt.get("tx_data", {}).get("contract_address") if isinstance(receipt, dict) else None)
        )
    if not contract_address:
        print("[deploy] WARNING: could not locate contract_address in receipt; dumping:")
        print(json.dumps(receipt if isinstance(receipt, dict) else receipt.__dict__, indent=2, default=str))
        _fatal("no contract_address in receipt")

    print(f"[deploy] SUCCESS")
    print(f"[deploy] contract address = {contract_address}")

    # Update deployed_addresses.json
    prev = json.loads(DEPLOYMENTS_PATH.read_text()) if DEPLOYMENTS_PATH.exists() else {}
    prior_entry = prev.get("studionet")
    history = prev.get("studionet_previous", [])
    if prior_entry:
        history.insert(0, prior_entry)

    new_entry = {
        "NDASentinel": contract_address,
        "deployed_at": time.strftime("%Y-%m-%d"),
        "version": version,
        "source": "contracts/nda_sentinel.py",
        "class": "NDASentinel",
        "rpc": chain.rpc_urls["default"]["http"][0] if hasattr(chain, "rpc_urls") else "https://studio.genlayer.com/api",
        "deployer": acct.address,
        "tx_hash": tx_hash if isinstance(tx_hash, str) else tx_hash.hex(),
        "notes": args.notes,
    }
    prev["studionet"] = new_entry
    prev["studionet_previous"] = history
    DEPLOYMENTS_PATH.write_text(json.dumps(prev, indent=2) + "\n")
    print(f"[deploy] wrote {DEPLOYMENTS_PATH}")


if __name__ == "__main__":
    main()
