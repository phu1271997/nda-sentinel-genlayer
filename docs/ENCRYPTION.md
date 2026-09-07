# E2E Encryption Vault — NDA Sentinel v0.2.26

> **v0.2.26 Milestone 1 rebuild.** Staff rejected the v0.2.22
> deterministic-key registry as too simple — it let anyone self-declare
> any pubkey. v0.2.26 moves every key-lifecycle transition behind an
> AI-Jury `eq_principle` attestation (validators fetch a proof URL the
> user hosts and reach consensus on a four-fact check), adds K-of-N
> guardian-based social recovery where each guardian approval is ALSO
> AI-attested, session-key rotation on live encrypted NDAs, revocation,
> and a per-user append-only key transparency log. Encrypted NDAs now
> refuse to be created unless both parties hold a VERIFIED (attested)
> key.

## Verified key lifecycle (v0.2.26)

Every state change on an encryption key goes through the AI Jury via
`gl.eq_principle.prompt_comparative`, exactly as the publisher-identity
flow does today. Validators independently fetch the user-hosted proof
URL via `gl.nondet.web.render` and must reach consensus on FOUR facts:

1. `PUBKEY SEEN` — the fetched page contains the claimed pubkey.
2. `ADDRESS SEEN` — the fetched page contains the caller's lowercase
   0x-prefixed address exactly.
3. `CHALLENGE SEEN` — the fetched page contains the challenge phrase
   verbatim.
4. `KIND SEEN` — the fetched page mentions the attestation kind
   (`REGISTER` / `ROTATE` / `REVOKE` / `GUARDIAN_APPROVE`) so a page
   authored for one operation cannot be replayed against another.

Consensus is enforced by an explicit principle that says every
validator must independently fetch the proof URL — if a validator's
fetch fails, they MUST default to `verified=false` rather than
accepting the leader's true.

## Contract methods

| Method | Path | AI-attested? |
|---|---|---|
| `register_encryption_key(pubkey, algo)` | legacy self-declared | ❌ marked UNVERIFIED, cannot back encrypted NDAs |
| `register_encryption_key_with_proof(pubkey, algo, proof_url, challenge)` | primary | ✅ eq_principle |
| `rotate_encryption_key(new_pubkey, new_algo, proof_url, challenge)` | rotation | ✅ eq_principle |
| `revoke_encryption_key(reason_url, challenge)` | revocation | ✅ eq_principle |
| `set_recovery_guardians(guardians_json, threshold)` | guardian config | deterministic |
| `initiate_key_recovery(new_pubkey, new_algo)` | announce recovery | deterministic (caller still owns the address) |
| `guardian_approve_recovery(user_hex, approval_url, challenge)` | guardian co-sign | ✅ eq_principle per guardian |
| `rotate_nda_session_key(nda_id, new_ct_a, new_ct_b, new_meta)` | per-NDA session-key rotation | deterministic (both parties are known) |

### Views

| View | Returns |
|---|---|
| `get_encryption_key_status(user)` | one of `unverified` / `verified` / `rotating` / `revoked` |
| `get_encryption_key_card(user)` | single-call profile (pubkey, algo, status, rotation counter, proof URL, challenge, last history entry) |
| `get_key_history(user)` | append-only audit log (bounded to 100 entries per user) |
| `get_recovery_status(user)` | guardians, threshold, pending pubkey, approvals dict + count |
| `get_nda_session_history(nda_id)` | last 5 rotations for a given encrypted NDA |
| `get_verified_encryption_limits()` | guardian/threshold/status bounds |

### Encrypted-NDA gate

`create_encrypted_nda(...)` now requires BOTH parties'
`get_encryption_key_status` to be `verified`. A self-declared UNVERIFIED
key will be rejected at contract level — the encrypted-NDA path stands
on the AI-attested foundation, not on a trust-me-bro pubkey drop.

### Social recovery flow

1. User calls `set_recovery_guardians([g1, g2, g3], threshold=2)`.
2. User (later, having lost their local private key) calls
   `initiate_key_recovery(new_pubkey, algo)` — announces the pubkey they
   want their guardians to attest to. Guardians are notified via the
   v0.2.24 inbox.
3. Each guardian publishes an approval page at a URL they control
   containing (a) the user's address, (b) the new pubkey, (c) the
   challenge phrase, (d) the literal `GUARDIAN_APPROVE`, then calls
   `guardian_approve_recovery(user_hex, approval_url, challenge)`.
   Validators AI-verify the approval page independently.
4. Once `threshold` approvals accumulate, `_finalize_recovery_internal`
   fires atomically: the pending pubkey replaces the user's old one,
   rotation counter increments, key status flips back to `verified`,
   and the transparency log records the transition.

### Session-key rotation on live NDAs

Any party to an encrypted NDA can call `rotate_nda_session_key` to push
a fresh dual envelope. Old envelope is archived into
`nda_session_history_json` (bounded to last 5 rotations) so previous
readers keep working. Rotation is blocked if either party's key is
`revoked` — the caller must run the recovery flow first.

### Key transparency log

Every write to a user's key state (self-declared, registered, rotated,
revoked, guardians set, recovery initiated, guardian approved, recovery
finalized) appends an entry to
`encryption_key_history_json[user]` bounded at 100 entries per user.
The `/keys/history` frontend page renders this as a
Certificate-Transparency-style audit trail — anyone about to encrypt
for a party can audit the pubkey history first.



## Threat model

Before v0.2.22 every field of an NDA was public on-chain. The salted
keyword hashes were opaque, but the `context_description` was arbitrary
free text: an adversary indexing state could read "Term sheet with
Sequoia — $45M at 0.7 % discount" verbatim. The Milestone 1 upgrade
adds an **end-to-end encrypted vault path** so that only two things stay
public on an encrypted NDA:

1. The two parties' addresses, scope, stake, expiry, and keyword hash
   list. These have to be public — the AI Jury needs them to slash.
2. A short human-readable **public hint** (≤ 100 chars) the parties
   choose.

Everything else — the full context, the raw keyword list, the salt — is
encrypted client-side into a **dual envelope**: one ciphertext addressed
to each party's registered ECDH public key. GenLayer validators never
see the plaintext.

Note that the leak-report path is unchanged: the reporter still calls
`report_leak` with revealed keywords + salt in the clear (that is the
whole point of a leak report — reveal the secret to prove ownership).
The encryption vault protects the NDA *at rest*, not during a report.

## Wire format

- **`create_encrypted_nda(counterparty_hex, scope, public_hint, expiry_timestamp, keyword_hashes_json, ciphertext_for_a, ciphertext_for_b, envelope_meta_json)`**
  - `ciphertext_for_a`, `ciphertext_for_b` — base64-encoded envelopes,
    32–8000 chars each. Contract-enforced distinctness prevents a caller
    from accidentally sending a single-recipient encrypt.
  - `envelope_meta_json` — free-form JSON metadata (algo string,
    version, pubkey fingerprints). ≤ 2000 chars.

- **`get_encrypted_context(nda_id) -> str`** — returns
  `{"is_encrypted": bool, "ciphertext_a": str, "ciphertext_b": str,
  "envelope_meta_json": str}`.

- **`register_encryption_key(pubkey_hex, algo)`** — writes the caller's
  public key. `algo` ∈ {`ecdh-p256`, `x25519`}. Deterministic path.

- **`get_encryption_key(user) -> str`** — returns
  `{"pubkey": str, "algo": str, "registered_at": str}`.

## Envelope layout (ecdh-p256+hkdf-sha256+aes-256-gcm, v1)

Raw bytes before base64:

```
[ 65 bytes ] ephemeral sender ECDH-P256 public key (uncompressed raw, 04-prefixed)
[ 12 bytes ] AES-GCM IV
[   *    ] AES-GCM ciphertext (16-byte auth tag appended by WebCrypto)
```

Sender flow (frontend):
1. Fetch recipient pubkey from `get_encryption_key(recipient)`.
2. Generate an ephemeral ECDH-P256 keypair.
3. `sharedBits = ECDH(ephem_priv, recipient_pub)`.
4. `aesKey = HKDF-SHA-256(sharedBits, info="NDA-Sentinel/E2EE/v1", salt="")`.
5. `ct = AES-GCM(aesKey, iv=random(12), plaintext)`.
6. `envelope = base64(ephem_pub || iv || ct)`.

Recipient flow (frontend):
1. Extract the envelope addressed to their party role from
   `get_encrypted_context(nda_id)`.
2. Recover `sharedBits = ECDH(own_priv, ephem_pub)`.
3. `aesKey = HKDF-SHA-256(sharedBits, info=…, salt="")`.
4. `plaintext = AES-GCM-decrypt(aesKey, iv, ct)`.

## Local keystore

The private key is stored **only in the browser**, wrapped in an
AES-GCM ciphertext derived from a user-chosen password:

```
KDF: PBKDF2-SHA-256, 250 000 iterations, 16-byte random salt
Key: 32-byte AES-256-GCM
Payload: PKCS8-encoded ECDH private key
```

The sealed keystore lives in `localStorage` under
`nda-sentinel:enc-keystore:<address>`. Export/import is supported so
users can move keys between browsers.

## Rotation & recovery

There is no in-contract recovery flow. Losing the local password loses
every envelope addressed to that key. To rotate, generate a new keypair,
publish it, and — for continuity — re-share the old plaintext with the
counterparty out-of-band; existing encrypted NDAs cannot be rewrapped
in-place because the contract deliberately does not accept a plaintext
re-upload.

## Non-goals

- **No re-encryption oracle.** The contract never sees a plaintext, so
  it cannot rotate an NDA to a new key. This is intentional — a
  re-encryption oracle would defeat the "GenLayer validators don't see
  the secret" guarantee.
- **No wallet-derived key.** MetaMask does not expose secp256k1 ECDH
  primitives cleanly, and reusing the wallet signing key for encryption
  is a well-known anti-pattern. The encryption keypair is separate.
- **No forward secrecy beyond envelope-level.** Each envelope uses a
  fresh ephemeral sender key, but the long-term recipient key is
  reused; a future compromise of the recipient key decrypts all past
  envelopes addressed to it. This matches the standard ECIES threat
  model.
