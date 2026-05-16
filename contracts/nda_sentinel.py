# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json
import hashlib

REPORT_FEE_WEI = 1_000_000_000_000_000_000          # 1 GEN
APPEAL_FEE_BPS = 1000                                # 10% of slashed amount
PROTOCOL_FEE_BPS = 300                               # 3% of slashed amount
MAX_KEYWORDS_PER_NDA = 50
MIN_KEYWORD_HASH_LEN = 64                            # sha256 hex
MAX_KEYWORD_HASH_LEN = 64
ALLOWED_SCOPES = (
    "ma_pricing", "product_roadmap", "source_code", "personal_info",
    "financial_data", "trade_secret", "employment_terms", "litigation_info",
    "research_data", "customer_list", "other"
)

@allow_storage
@dataclass
class NDA:
    id: u256
    party_a: Address
    party_b: Address
    creator: Address
    scope: str
    context_description: str
    expiry_timestamp: u256
    stake_a: u256
    stake_b: u256
    status: str
    created_at: u256
    activated_at: u256
    keyword_hash_count: u256
    suspect_url: str
    verdict_json: str
    violator: Address
    slashed_amount: u256
    reporter: Address

@allow_storage
@dataclass
class Appeal:
    nda_id: u256
    appellant: Address
    appeal_stake: u256
    counter_evidence: str
    submitted_at: u256
    resolved: bool
    overturned: bool
    final_verdict_json: str

class NDASentinel(gl.Contract):
    ndas: DynArray[NDA]
    nda_index_by_id: TreeMap[u256, u256]
    nda_keyword_hashes_json: TreeMap[u256, str]   # nda_id -> JSON list of hashes
    
    user_nda_ids_json: TreeMap[Address, str]      # address -> JSON list of nda_ids
    
    appeals: DynArray[Appeal]
    appeal_by_nda: TreeMap[u256, u256]            # nda_id -> appeal index in appeals
    
    withdrawable: TreeMap[Address, u256]
    
    next_nda_id: u256
    treasury: u256
    owner: Address
    
    total_ndas_created: u256
    total_violations_confirmed: u256
    total_value_slashed: u256

    def __init__(self):
        self.owner = gl.message.sender_address

    @gl.public.write.payable
    def create_nda(self, counterparty_hex: str, scope: str, context_description: str, expiry_timestamp: u256, keyword_hashes_json: str) -> u256:
        sender = gl.message.sender_address
        counterparty = Address(counterparty_hex)
        
        if counterparty == sender:
            raise gl.vm.UserError("Counterparty cannot be sender")
            
        if scope not in ALLOWED_SCOPES:
            raise gl.vm.UserError(f"Scope must be one of {ALLOWED_SCOPES}")
            
        if len(context_description) < 1 or len(context_description) > 500:
            raise gl.vm.UserError("Context description length must be 1-500")
            
        current_time = gl.message.timestamp
        if int(expiry_timestamp) <= int(current_time):
            raise gl.vm.UserError("Expiry must be in the future")
            
        hashes = json.loads(keyword_hashes_json)
        if not isinstance(hashes, list) or len(hashes) == 0 or len(hashes) > MAX_KEYWORDS_PER_NDA:
            raise gl.vm.UserError(f"Must provide 1 to {MAX_KEYWORDS_PER_NDA} keyword hashes")
            
        for h in hashes:
            if not isinstance(h, str) or len(h) != 64:
                raise gl.vm.UserError("Each hash must be a 64-char hex string")
                
        val = gl.message.value
        if int(val) <= 0:
            raise gl.vm.UserError("Stake amount must be > 0")

        new_id = self.next_nda_id
        
        a = NDA(
            id=new_id,
            party_a=sender,
            party_b=counterparty,
            creator=sender,
            scope=scope,
            context_description=context_description,
            expiry_timestamp=expiry_timestamp,
            stake_a=val,
            stake_b=u256(0),
            status="pending",
            created_at=current_time,
            activated_at=u256(0),
            keyword_hash_count=u256(len(hashes)),
            suspect_url="",
            verdict_json="",
            violator=Address("0x0000000000000000000000000000000000000000"),
            slashed_amount=u256(0),
            reporter=Address("0x0000000000000000000000000000000000000000")
        )
        
        self.ndas.append(a)
        self.nda_index_by_id[new_id] = u256(len(self.ndas) - 1)
        self.nda_keyword_hashes_json[new_id] = json.dumps(hashes)
        
        # update user nda lists
        for user in [sender, counterparty]:
            existing_str = self.user_nda_ids_json.get(user, "[]")
            existing = json.loads(existing_str)
            existing.append(int(new_id))
            self.user_nda_ids_json[user] = json.dumps(existing)
            
        self.next_nda_id = u256(int(new_id) + 1)
        self.total_ndas_created = u256(int(self.total_ndas_created) + 1)
        
        return new_id

    @gl.public.write.payable
    def activate_nda(self, nda_id: u256) -> None:
        idx = int(self.nda_index_by_id.get(nda_id, u256(999999999)))
        if idx >= len(self.ndas) or self.ndas[idx].id != nda_id:
            raise gl.vm.UserError("NDA not found")
            
        nda = self.ndas[idx]
        if nda.status != "pending":
            raise gl.vm.UserError("NDA is not pending")
            
        if gl.message.sender_address != nda.party_b:
            raise gl.vm.UserError("Only party_b can activate")
            
        val = gl.message.value
        if int(val) <= 0:
            raise gl.vm.UserError("Activation stake must be > 0")
            
        nda.stake_b = val
        nda.status = "active"
        nda.activated_at = gl.message.timestamp
        self.ndas[idx] = nda

    @gl.public.write.payable
    def report_leak(self, nda_id: u256, suspect_url: str, revealed_keywords_json: str, salt: str) -> None:
        idx = int(self.nda_index_by_id.get(nda_id, u256(999999999)))
        if idx >= len(self.ndas) or self.ndas[idx].id != nda_id:
            raise gl.vm.UserError("NDA not found")
            
        nda = self.ndas[idx]
        if nda.status != "active":
            raise gl.vm.UserError("NDA is not active")
            
        sender = gl.message.sender_address
        if sender != nda.party_a and sender != nda.party_b:
            raise gl.vm.UserError("Only a party to the NDA can report")
            
        val = gl.message.value
        if int(val) < REPORT_FEE_WEI:
            raise gl.vm.UserError(f"Report fee must be at least {REPORT_FEE_WEI}")
            
        revealed_keywords = json.loads(revealed_keywords_json)
        if not isinstance(revealed_keywords, list) or len(revealed_keywords) == 0:
            raise gl.vm.UserError("Must reveal at least one keyword")
            
        for k in revealed_keywords:
            if not isinstance(k, str) or len(k) < 1 or len(k) > 200:
                raise gl.vm.UserError("Each revealed keyword must be 1-200 chars")
                
        if len(salt) < 16 or len(salt) > 256:
            raise gl.vm.UserError("Salt length must be 16-256 chars")
            
        stored_hashes_str = self.nda_keyword_hashes_json[nda_id]
        stored_hashes = json.loads(stored_hashes_str)
        stored_hashes_set = set(stored_hashes)
        
        match_count = 0
        for kw in revealed_keywords:
            # Deterministic hash check outside non-det block
            h = hashlib.sha256((kw + salt).encode("utf-8")).hexdigest()
            if h in stored_hashes_set:
                match_count += 1
                
        if match_count == 0:
            raise gl.vm.UserError("No revealed keywords matched the stored hashes")
            
        nda_mem = gl.storage.copy_to_memory(nda)
        
        def leader_fn():
            try:
                content = gl.nondet.web.render(suspect_url, mode="text")
                if len(content) > 8000:
                    content = content[:8000]
            except Exception as e:
                # If rendering fails, we can return an inconclusive result
                return {
                    "verdict": "inconclusive",
                    "confidence": 0,
                    "responsible_party": "unknown",
                    "match_score": 0,
                    "specificity_score": 0,
                    "prior_disclosure_found": False,
                    "intent": "unknown",
                    "reasoning": f"Failed to fetch content: {str(e)}",
                    "evidence_quote": "",
                    "matched_keywords_count": 0
                }
                
            prompt = f"""
You are the AI Jury for an NDA enforcement protocol. You MUST follow these rules EXACTLY and return STRICTLY VALID JSON.

=== NDA CONTEXT ===
NDA Scope category: {nda_mem.scope}
NDA context (public): {nda_mem.context_description}
NDA created on: {int(nda_mem.created_at)}
NDA expires on: {int(nda_mem.expiry_timestamp)}

=== PROTECTED INFORMATION ===
The reporter has cryptographically proven knowledge of these protected keywords/phrases:
{json.dumps(revealed_keywords)}

=== SUSPECT CONTENT ===
URL: {suspect_url}
Fetched content:
---
{content}
---

=== YOUR ANALYSIS TASK ===
1. CONTENT MATCH (40% weight): Does the suspect content actually disclose the SUBSTANCE of any protected keywords?
2. SPECIFICITY (20%): Is the disclosed info specific enough to be a real violation?
3. PRIOR PUBLIC DISCLOSURE (15%): Was this information ALREADY publicly known before the NDA was signed?
4. ATTRIBUTION (15%): Who posted the suspect content? (party_a, party_b, unknown)
5. INTENT (10%): Was this leak intentional or accidental?

=== FINAL VERDICT RULES ===
- If ANY protected keyword's substance is disclosed AND specificity > 60 AND no prior disclosure -> "violation_confirmed"
- If content does NOT disclose protected substance -> "no_violation"
- If you cannot determine due to ambiguity, anonymous source, or insufficient evidence -> "inconclusive"

=== OUTPUT (JSON ONLY) ===
{{
  "verdict": "violation_confirmed" | "no_violation" | "inconclusive",
  "confidence": <0-100>,
  "responsible_party": "party_a" | "party_b" | "unknown" | "both",
  "match_score": <0-100>,
  "specificity_score": <0-100>,
  "prior_disclosure_found": <true/false>,
  "intent": "intentional" | "accidental" | "coerced" | "unknown",
  "reasoning": "<3-5 sentences>",
  "evidence_quote": "<snippet>",
  "matched_keywords_count": <int>
}}
"""
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            try:
                return json.loads(res)
            except Exception:
                return {
                    "verdict": "inconclusive",
                    "confidence": 0,
                    "responsible_party": "unknown",
                    "match_score": 0,
                    "specificity_score": 0,
                    "prior_disclosure_found": False,
                    "intent": "unknown",
                    "reasoning": "LLM failed to output valid JSON",
                    "evidence_quote": "",
                    "matched_keywords_count": 0
                }

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            leader_data = leader_result.calldata
            validator_data = leader_fn()
            
            if leader_data.get("verdict") != validator_data.get("verdict"):
                return False
            if leader_data.get("responsible_party") != validator_data.get("responsible_party"):
                return False
            if leader_data.get("prior_disclosure_found") != validator_data.get("prior_disclosure_found"):
                return False
                
            if abs(int(leader_data.get("confidence", 0)) - int(validator_data.get("confidence", 0))) > 15:
                return False
            if abs(int(leader_data.get("match_score", 0)) - int(validator_data.get("match_score", 0))) > 15:
                return False
            if abs(int(leader_data.get("matched_keywords_count", 0)) - int(validator_data.get("matched_keywords_count", 0))) > 1:
                return False
                
            return True
            
        result_payload = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        
        verdict = result_payload.get("verdict", "inconclusive")
        
        if verdict == "violation_confirmed":
            resp_party_str = result_payload.get("responsible_party", "unknown")
            violator = nda.party_a if resp_party_str == "party_a" else (nda.party_b if resp_party_str == "party_b" else Address("0x0000000000000000000000000000000000000000"))
            
            if violator != Address("0x0000000000000000000000000000000000000000"):
                slash_pool = nda.stake_a if violator == nda.party_a else nda.stake_b
                other_party = nda.party_b if violator == nda.party_a else nda.party_a
                
                if int(slash_pool) > 0:
                    reporter_reward = (int(slash_pool) * 80) // 100
                    treasury_fee = (int(slash_pool) * 3) // 100
                    compensation = int(slash_pool) - reporter_reward - treasury_fee
                    
                    self.withdrawable[sender] = u256(int(self.withdrawable.get(sender, u256(0))) + reporter_reward)
                    self.treasury = u256(int(self.treasury) + treasury_fee)
                    self.withdrawable[other_party] = u256(int(self.withdrawable.get(other_party, u256(0))) + compensation)
                    
                    nda.slashed_amount = slash_pool
                    self.total_value_slashed = u256(int(self.total_value_slashed) + int(slash_pool))
                    
                    if violator == nda.party_a:
                        nda.stake_a = u256(0)
                    else:
                        nda.stake_b = u256(0)
            
            nda.status = "leaked"
            nda.suspect_url = suspect_url
            nda.verdict_json = json.dumps(result_payload)
            nda.violator = violator
            nda.reporter = sender
            self.total_violations_confirmed = u256(int(self.total_violations_confirmed) + 1)
            
        elif verdict == "no_violation":
            # Forfeit report fee to violator (the other party)
            other_party = nda.party_b if sender == nda.party_a else nda.party_a
            self.withdrawable[other_party] = u256(int(self.withdrawable.get(other_party, u256(0))) + int(val))
            # Status stays active
            
        else: # inconclusive
            # Refund report fee
            self.withdrawable[sender] = u256(int(self.withdrawable.get(sender, u256(0))) + int(val))
            # Status stays active
            
        self.ndas[idx] = nda

    @gl.public.write.payable
    def appeal(self, nda_id: u256, counter_evidence: str) -> None:
        idx = int(self.nda_index_by_id.get(nda_id, u256(999999999)))
        if idx >= len(self.ndas) or self.ndas[idx].id != nda_id:
            raise gl.vm.UserError("NDA not found")
            
        nda = self.ndas[idx]
        if nda.status != "leaked":
            raise gl.vm.UserError("NDA is not leaked")
            
        sender = gl.message.sender_address
        if sender != nda.violator:
            raise gl.vm.UserError("Only the determined violator can appeal")
            
        appeal_fee = (int(nda.slashed_amount) * APPEAL_FEE_BPS) // 10000
        val = gl.message.value
        if int(val) < appeal_fee:
            raise gl.vm.UserError(f"Appeal fee must be at least {appeal_fee}")
            
        if len(counter_evidence) > 2000:
            raise gl.vm.UserError("Counter evidence max length 2000")
            
        app_id = u256(len(self.appeals))
        new_appeal = Appeal(
            nda_id=nda_id,
            appellant=sender,
            appeal_stake=val,
            counter_evidence=counter_evidence,
            submitted_at=gl.message.timestamp,
            resolved=False,
            overturned=False,
            final_verdict_json=""
        )
        self.appeals.append(new_appeal)
        self.appeal_by_nda[nda_id] = app_id
        
        nda.status = "appeal_pending"
        self.ndas[idx] = nda
        
        nda_mem = gl.storage.copy_to_memory(nda)
        
        def leader_fn():
            prompt = f"""
You are the AI Appellate Jury for an NDA enforcement protocol.
Earlier, an AI Jury found a violation. The violator is appealing with counter-evidence.

=== ORIGINAL VERDICT ===
{nda_mem.verdict_json}

=== COUNTER EVIDENCE ===
{counter_evidence}

Does the counter evidence conclusively prove that the prior public disclosure existed or that the attribution/intent was entirely wrong?
Return JSON:
{{
  "verdict": "overturned" | "upheld" | "inconclusive",
  "reasoning": "..."
}}
"""
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            try:
                return json.loads(res)
            except Exception:
                return {"verdict": "inconclusive", "reasoning": "JSON parse failed"}

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return): return False
            leader_data = leader_result.calldata
            validator_data = leader_fn()
            return leader_data.get("verdict") == validator_data.get("verdict")
            
        result_payload = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        verdict = result_payload.get("verdict", "inconclusive")
        
        app = self.appeals[int(app_id)]
        app.resolved = True
        app.final_verdict_json = json.dumps(result_payload)
        
        if verdict == "overturned":
            app.overturned = True
            # Return slashed amount and appeal fee to violator (appellant)
            self.withdrawable[sender] = u256(int(self.withdrawable.get(sender, u256(0))) + int(nda_mem.slashed_amount) + int(val))
            # Note: Clawing back reporter reward would mean we either have to deduct from their withdrawable balance (which might go negative or they might have withdrawn it).
            # In a real V2, we might hold funds in escrow until appeal period passes. For now we will deduct if possible.
            reporter_reward = (int(nda_mem.slashed_amount) * 80) // 100
            curr_reporter_bal = int(self.withdrawable.get(nda_mem.reporter, u256(0)))
            if curr_reporter_bal >= reporter_reward:
                self.withdrawable[nda_mem.reporter] = u256(curr_reporter_bal - reporter_reward)
            else:
                self.withdrawable[nda_mem.reporter] = u256(0)
            
            nda.status = "active"
            nda.slashed_amount = u256(0)
            nda.violator = Address("0x0000000000000000000000000000000000000000")
            
        else: # upheld or inconclusive
            # Appeal fee forfeit to treasury
            self.treasury = u256(int(self.treasury) + int(val))
            nda.status = "leaked"
            
        self.appeals[int(app_id)] = app
        self.ndas[idx] = nda

    @gl.public.write
    def expire_and_withdraw(self, nda_id: u256) -> None:
        idx = int(self.nda_index_by_id.get(nda_id, u256(999999999)))
        if idx >= len(self.ndas) or self.ndas[idx].id != nda_id:
            raise gl.vm.UserError("NDA not found")
            
        nda = self.ndas[idx]
        if nda.status != "active":
            raise gl.vm.UserError("NDA is not active")
            
        # Optional: verify timestamp
        if int(gl.message.timestamp) < int(nda.expiry_timestamp):
            raise gl.vm.UserError("Not expired yet")
            
        nda.status = "expired"
        
        self.withdrawable[nda.party_a] = u256(int(self.withdrawable.get(nda.party_a, u256(0))) + int(nda.stake_a))
        self.withdrawable[nda.party_b] = u256(int(self.withdrawable.get(nda.party_b, u256(0))) + int(nda.stake_b))
        
        nda.stake_a = u256(0)
        nda.stake_b = u256(0)
        
        self.ndas[idx] = nda

    @gl.public.write
    def withdraw(self) -> None:
        sender = gl.message.sender_address
        amount = int(self.withdrawable.get(sender, u256(0)))
        if amount == 0:
            raise gl.vm.UserError("No funds to withdraw")
            
        self.withdrawable[sender] = u256(0)
        gl.message.send_value(sender, u256(amount))

    @gl.public.view
    def get_nda(self, nda_id: u256) -> NDA:
        idx = int(self.nda_index_by_id.get(nda_id, u256(999999999)))
        if idx >= len(self.ndas) or self.ndas[idx].id != nda_id:
            raise gl.vm.UserError("NDA not found")
        return self.ndas[idx]

    @gl.public.view
    def get_user_ndas(self, user: Address) -> str:
        # Returns JSON list of NDAs
        ids_str = self.user_nda_ids_json.get(user, "[]")
        ids = json.loads(ids_str)
        res = []
        for id_val in ids:
            idx = int(self.nda_index_by_id.get(u256(id_val), u256(999999999)))
            if idx < len(self.ndas):
                nda = self.ndas[idx]
                res.append({
                    "id": str(nda.id),
                    "party_a": nda.party_a.as_hex,
                    "party_b": nda.party_b.as_hex,
                    "scope": nda.scope,
                    "status": nda.status,
                    "stake_a": str(nda.stake_a),
                    "stake_b": str(nda.stake_b),
                    "expiry_timestamp": str(nda.expiry_timestamp)
                })
        return json.dumps(res)

    @gl.public.view
    def get_keyword_hashes(self, nda_id: u256) -> str:
        return self.nda_keyword_hashes_json.get(nda_id, "[]")

    @gl.public.view
    def get_appeal(self, nda_id: u256) -> Appeal:
        app_id = self.appeal_by_nda.get(nda_id, u256(999999999))
        if int(app_id) >= len(self.appeals):
            raise gl.vm.UserError("No appeal found")
        return self.appeals[int(app_id)]

    @gl.public.view
    def get_withdrawable(self, user: Address) -> u256:
        return self.withdrawable.get(user, u256(0))

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "total_ndas_created": str(self.total_ndas_created),
            "total_violations_confirmed": str(self.total_violations_confirmed),
            "total_value_slashed": str(self.total_value_slashed),
            "treasury": str(self.treasury),
        })
