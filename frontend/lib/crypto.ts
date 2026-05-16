import { sha256 } from "js-sha256";

// Hash function MUST be byte-identical to contract verification
// Contract does: hashlib.sha256((kw + salt).encode("utf-8")).hexdigest()
export function hashKeyword(keyword: string, salt: string): string {
  return sha256(keyword + salt);
}

export function generateSalt(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}
