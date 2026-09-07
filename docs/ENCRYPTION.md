# E2E Encryption Vault — NDA Sentinel v0.2.22

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
