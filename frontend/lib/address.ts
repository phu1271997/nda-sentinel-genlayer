export function normalizeAddress(addr: string | undefined | null): string {
    if (!addr) return "";
    return addr.trim().toLowerCase();
}

export function addressEquals(a: string | undefined | null, b: string | undefined | null): boolean {
    if (!a || !b) return false;
    return normalizeAddress(a) === normalizeAddress(b);
}
