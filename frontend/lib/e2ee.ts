// E2E-encryption primitives (v0.2.22 — Milestone A).
//
// Design: ECDH P-256 key exchange + HKDF-SHA-256 + AES-256-GCM. Runs
// entirely inside the browser via WebCrypto — no libraries pulled in.
// Ephemeral sender keypair per envelope, so ciphertexts leak no
// long-term link between two encrypted-NDA payloads.
//
// Envelope layout (raw bytes, base64-encoded for on-chain storage):
//   [ 65 bytes ] ephemeral sender ECDH-P256 public key (uncompressed raw)
//   [ 12 bytes ] AES-GCM IV
//   [   *    ] AES-GCM ciphertext (auth-tag appended by WebCrypto)
//
// Length after base64 for a typical 500-byte plaintext ≈ 800 chars,
// well inside the contract's MAX_ENC_CIPHERTEXT_LEN=8000.

const KDF_INFO = new Uint8Array(
  new TextEncoder().encode("NDA-Sentinel/E2EE/v1"),
)
// Cast helper: TS 5.7 tightened Uint8Array<ArrayBufferLike> vs BufferSource.
// WebCrypto happily accepts either at runtime; the cast keeps the type check
// terse without polluting every call site.
function bs(u: Uint8Array): BufferSource {
  return u as unknown as BufferSource
}
const EPHEM_PUB_LEN = 65
const IV_LEN = 12

// ---------------------------------------------------------------------------
// Hex / base64 codecs
// ---------------------------------------------------------------------------

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  if (clean.length % 2 !== 0) {
    throw new Error("hex string must have even length")
  }
  const buf = new ArrayBuffer(clean.length / 2)
  const out = new Uint8Array(buf)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = ""
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64)
  const buf = new ArrayBuffer(s.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const buf = new ArrayBuffer(total)
  const out = new Uint8Array(buf)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

// ---------------------------------------------------------------------------
// Keypair generation, export/import
// ---------------------------------------------------------------------------

export interface EncryptionKeypair {
  publicKeyHex: string // 130 hex chars, uncompressed raw (04 prefix + X + Y)
  privateKeyPkcs8B64: string // base64-encoded PKCS8 blob
  algo: "ecdh-p256"
  createdAt: number
}

export async function generateEncryptionKeypair(): Promise<EncryptionKeypair> {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )
  const rawPubBuf = await crypto.subtle.exportKey("raw", kp.publicKey!)
  const rawPub = new Uint8Array(rawPubBuf as ArrayBuffer)
  const pkcs8Buf = await crypto.subtle.exportKey("pkcs8", kp.privateKey!)
  const pkcs8Priv = new Uint8Array(pkcs8Buf as ArrayBuffer)
  return {
    publicKeyHex: bytesToHex(rawPub),
    privateKeyPkcs8B64: bytesToBase64(pkcs8Priv),
    algo: "ecdh-p256",
    createdAt: Date.now(),
  }
}

async function importPubkey(pubkeyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    bs(hexToBytes(pubkeyHex)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  )
}

async function importPrivkey(pkcs8B64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    bs(base64ToBytes(pkcs8B64)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  )
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt
// ---------------------------------------------------------------------------

async function deriveAesKey(sharedBits: ArrayBuffer): Promise<CryptoKey> {
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedBits,
    "HKDF",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: bs(new Uint8Array(new ArrayBuffer(0))),
      info: bs(KDF_INFO),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

/** Encrypt plaintext for a single recipient (ECDH-P256 public key hex). */
export async function encryptToRecipient(
  recipientPubkeyHex: string,
  plaintext: string,
): Promise<string> {
  const recipientPub = await importPubkey(recipientPubkeyHex)
  const ephem = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: recipientPub },
    ephem.privateKey!,
    256,
  )
  const aesKey = await deriveAesKey(sharedBits)
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(IV_LEN)))
  const ptBytes = new Uint8Array(new TextEncoder().encode(plaintext))
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bs(iv) },
    aesKey,
    bs(ptBytes),
  )
  const ct = new Uint8Array(ctBuf as ArrayBuffer)
  const ephemPubBuf = await crypto.subtle.exportKey("raw", ephem.publicKey!)
  const ephemPub = new Uint8Array(ephemPubBuf as ArrayBuffer)
  return bytesToBase64(concat(ephemPub, iv, ct))
}

/** Decrypt an envelope with the caller's own PKCS8 private key. */
export async function decryptFromEnvelope(
  envelopeB64: string,
  ownPrivkeyPkcs8B64: string,
): Promise<string> {
  const env = base64ToBytes(envelopeB64)
  if (env.length < EPHEM_PUB_LEN + IV_LEN + 16) {
    throw new Error("envelope too short")
  }
  const ephemPubRaw = env.slice(0, EPHEM_PUB_LEN)
  const iv = env.slice(EPHEM_PUB_LEN, EPHEM_PUB_LEN + IV_LEN)
  const ct = env.slice(EPHEM_PUB_LEN + IV_LEN)
  const ownPriv = await importPrivkey(ownPrivkeyPkcs8B64)
  const ephemPub = await crypto.subtle.importKey(
    "raw",
    bs(ephemPubRaw),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  )
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: ephemPub },
    ownPriv,
    256,
  )
  const aesKey = await deriveAesKey(sharedBits)
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bs(iv) },
    aesKey,
    bs(ct),
  )
  return new TextDecoder().decode(pt as ArrayBuffer)
}

// ---------------------------------------------------------------------------
// Password-protected keystore for the local private key.
//
// PBKDF2-SHA256 (250 000 iterations) → 32-byte AES-GCM key, applied to
// the PKCS8 private key blob. Ciphertext lives in localStorage; the
// password is prompted on every unlock and never persisted.
// ---------------------------------------------------------------------------

const PBKDF2_ITERS = 250_000

export interface SealedKeystore {
  version: 1
  algo: "ecdh-p256"
  publicKeyHex: string
  createdAt: number
  kdfSaltB64: string
  ivB64: string
  ciphertextB64: string
}

async function deriveKdfKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    "raw",
    bs(new Uint8Array(new TextEncoder().encode(password))),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: bs(salt), iterations: PBKDF2_ITERS },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export async function sealKeystore(
  kp: EncryptionKeypair,
  password: string,
): Promise<SealedKeystore> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)))
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(IV_LEN)))
  const aesKey = await deriveKdfKey(password, salt)
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bs(iv) },
    aesKey,
    bs(base64ToBytes(kp.privateKeyPkcs8B64)),
  )
  const ct = new Uint8Array(ctBuf as ArrayBuffer)
  return {
    version: 1,
    algo: "ecdh-p256",
    publicKeyHex: kp.publicKeyHex,
    createdAt: kp.createdAt,
    kdfSaltB64: bytesToBase64(salt),
    ivB64: bytesToBase64(iv),
    ciphertextB64: bytesToBase64(ct),
  }
}

export async function openKeystore(
  ks: SealedKeystore,
  password: string,
): Promise<EncryptionKeypair> {
  const aesKey = await deriveKdfKey(password, base64ToBytes(ks.kdfSaltB64))
  const ptBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bs(base64ToBytes(ks.ivB64)) },
    aesKey,
    bs(base64ToBytes(ks.ciphertextB64)),
  )
  const pt = new Uint8Array(ptBuf as ArrayBuffer)
  return {
    publicKeyHex: ks.publicKeyHex,
    privateKeyPkcs8B64: bytesToBase64(pt),
    algo: ks.algo,
    createdAt: ks.createdAt,
  }
}
