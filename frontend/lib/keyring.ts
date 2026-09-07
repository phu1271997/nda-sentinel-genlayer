// Session-scoped in-memory cache for the unlocked private key plus a
// localStorage-backed sealed keystore. The sealed keystore is
// password-protected (PBKDF2 → AES-GCM); we keep the unlocked key in
// memory only for the length of the browser tab lifetime.

import {
  EncryptionKeypair,
  SealedKeystore,
  generateEncryptionKeypair,
  openKeystore,
  sealKeystore,
} from "./e2ee"

const KEYSTORE_LS_PREFIX = "nda-sentinel:enc-keystore:"

function lsKey(address: string): string {
  return KEYSTORE_LS_PREFIX + address.toLowerCase()
}

export function loadSealedKeystore(address: string): SealedKeystore | null {
  if (typeof window === "undefined") return null
  try {
    const s = window.localStorage.getItem(lsKey(address))
    if (!s) return null
    const parsed = JSON.parse(s)
    if (parsed && parsed.version === 1) return parsed as SealedKeystore
    return null
  } catch {
    return null
  }
}

export function saveSealedKeystore(address: string, ks: SealedKeystore): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(lsKey(address), JSON.stringify(ks))
}

export function clearSealedKeystore(address: string): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(lsKey(address))
}

let unlockedByAddress: Record<string, EncryptionKeypair> = {}

export function getUnlockedKeypair(address: string): EncryptionKeypair | null {
  return unlockedByAddress[address.toLowerCase()] ?? null
}

export async function generateAndSeal(
  address: string,
  password: string,
): Promise<EncryptionKeypair> {
  const kp = await generateEncryptionKeypair()
  const sealed = await sealKeystore(kp, password)
  saveSealedKeystore(address, sealed)
  unlockedByAddress[address.toLowerCase()] = kp
  return kp
}

export async function unlockKeystore(
  address: string,
  password: string,
): Promise<EncryptionKeypair> {
  const sealed = loadSealedKeystore(address)
  if (!sealed) throw new Error("No keystore found for this address")
  const kp = await openKeystore(sealed, password)
  unlockedByAddress[address.toLowerCase()] = kp
  return kp
}

export function lockKeystore(address: string): void {
  delete unlockedByAddress[address.toLowerCase()]
}

export function lockAll(): void {
  unlockedByAddress = {}
}
