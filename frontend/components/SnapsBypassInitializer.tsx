"use client"

import { useEffect } from "react"
import { wrapProviderWithSnapsBypass } from "@/lib/snapsBypass"

export function SnapsBypassInitializer() {
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      (window as any).ethereum = wrapProviderWithSnapsBypass((window as any).ethereum);
    }
  }, [])

  return null
}
