import pytest
import json
import hashlib
from gltest import get_contract_factory, default_account, create_account
from gltest.assertions import tx_execution_succeeded, tx_execution_failed

# Standard test inputs
SCOPE = "source_code"
CONTEXT = "Codebase sharing for audit"
STAKE = 100_000_000_000_000_000_000 # 100 GEN
KEYWORDS = ["secret_algorithm", "private_key_123"]

def get_keyword_hashes(keywords, salt):
    return [hashlib.sha256((kw + salt).encode("utf-8")).hexdigest() for kw in keywords]

def test_deploy_and_initial_state():
    factory = get_contract_factory("NDASentinel")
    contract = factory.deploy()
    assert contract is not None
    
    stats_json = contract.get_stats(args=[])
    stats = json.loads(stats_json)
    assert int(stats["total_ndas_created"]) == 0
    assert int(stats["total_violations_confirmed"]) == 0
    assert int(stats["total_value_slashed"]) == 0
    assert int(stats["treasury"]) == 0

def test_create_nda_success():
    party_a = default_account
    party_b = create_account()
    
    factory = get_contract_factory("NDASentinel")
    contract = factory.deploy(account=party_a)
    
    salt = "supersecretsalt123"
    hashes = get_keyword_hashes(KEYWORDS, salt)
    hashes_json = json.dumps(hashes)
    
    # Expiry 1 day in the future (approx)
    expiry = 9999999999
    
    tx = contract.create_nda(
        args=[party_b.address, SCOPE, CONTEXT, expiry, hashes_json],
        value=STAKE
    )
    assert tx_execution_succeeded(tx)
    
    # Check stats
    stats_json = contract.get_stats(args=[])
    stats = json.loads(stats_json)
    assert int(stats["total_ndas_created"]) == 1
    
    # Check NDA detail
    nda_details = contract.get_nda(args=[0])
    assert nda_details["status"] == "pending"
    assert nda_details["scope"] == SCOPE
    assert nda_details["context_description"] == CONTEXT
    assert int(nda_details["stake_a"]) == STAKE
    assert int(nda_details["stake_b"]) == 0

def test_create_nda_invalid_cases():
    party_a = default_account
    party_b = create_account()
    
    factory = get_contract_factory("NDASentinel")
    contract = factory.deploy(account=party_a)
    
    salt = "supersecretsalt123"
    hashes = get_keyword_hashes(KEYWORDS, salt)
    hashes_json = json.dumps(hashes)
    expiry = 9999999999
    
    # 1. Counterparty cannot be sender
    tx = contract.create_nda(
        args=[party_a.address, SCOPE, CONTEXT, expiry, hashes_json],
        value=STAKE
    )
    assert tx_execution_failed(tx)
    
    # 2. Scope invalid
    tx = contract.create_nda(
        args=[party_b.address, "invalid_scope", CONTEXT, expiry, hashes_json],
        value=STAKE
    )
    assert tx_execution_failed(tx)
    
    # 3. Expiry in the past
    tx = contract.create_nda(
        args=[party_b.address, SCOPE, CONTEXT, 1000, hashes_json],
        value=STAKE
    )
    assert tx_execution_failed(tx)
    
    # 4. Zero stake
    tx = contract.create_nda(
        args=[party_b.address, SCOPE, CONTEXT, expiry, hashes_json],
        value=0
    )
    assert tx_execution_failed(tx)

def test_activate_nda_success():
    party_a = default_account
    party_b = create_account()
    
    factory = get_contract_factory("NDASentinel")
    contract = factory.deploy(account=party_a)
    
    salt = "supersecretsalt123"
    hashes = get_keyword_hashes(KEYWORDS, salt)
    hashes_json = json.dumps(hashes)
    expiry = 9999999999
    
    contract.create_nda(
        args=[party_b.address, SCOPE, CONTEXT, expiry, hashes_json],
        value=STAKE
    )
    
    # Activate from Party B
    contract_b = contract.connect(party_b)
    tx = contract_b.activate_nda(args=[0], value=STAKE)
    assert tx_execution_succeeded(tx)
    
    nda_details = contract.get_nda(args=[0])
    assert nda_details["status"] == "active"
    assert int(nda_details["stake_b"]) == STAKE

def test_activate_nda_invalid_sender():
    party_a = default_account
    party_b = create_account()
    party_c = create_account()
    
    factory = get_contract_factory("NDASentinel")
    contract = factory.deploy(account=party_a)
    
    salt = "supersecretsalt123"
    hashes = get_keyword_hashes(KEYWORDS, salt)
    hashes_json = json.dumps(hashes)
    expiry = 9999999999
    
    contract.create_nda(
        args=[party_b.address, SCOPE, CONTEXT, expiry, hashes_json],
        value=STAKE
    )
    
    # Try to activate from Party A (only Party B can activate)
    tx = contract.activate_nda(args=[0], value=STAKE)
    assert tx_execution_failed(tx)
    
    # Try to activate from Party C
    contract_c = contract.connect(party_c)
    tx = contract_c.activate_nda(args=[0], value=STAKE)
    assert tx_execution_failed(tx)

def test_cancel_pending_nda_early():
    party_a = default_account
    party_b = create_account()
    
    factory = get_contract_factory("NDASentinel")
    contract = factory.deploy(account=party_a)
    
    salt = "supersecretsalt123"
    hashes = get_keyword_hashes(KEYWORDS, salt)
    hashes_json = json.dumps(hashes)
    expiry = 9999999999
    
    contract.create_nda(
        args=[party_b.address, SCOPE, CONTEXT, expiry, hashes_json],
        value=STAKE
    )
    
    # Cancelling early (before 7 days timeout) should fail
    tx = contract.cancel_pending_nda(args=[0])
    assert tx_execution_failed(tx)
