"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { activeAddress, client, CONTRACT_ADDRESS, WALLET_CHANGED_EVENT } from "@/lib/genlayer"

const POLL_INTERVAL_MS = 30_000
const BROWSER_NOTIFICATION_KEY = "nda-sentinel:last-browser-notified-seq"

export function InboxBell() {
  const [count, setCount] = useState<number>(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!activeAddress) return
      try {
        const raw = (await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_inbox_unread_count",
          args: [activeAddress],
        })) as bigint
        if (cancelled) return
        const n = Number(raw ?? 0)
        setCount((prev) => {
          if (n > prev && n > 0) {
            void maybeBrowserNotify(activeAddress, n)
          }
          return n
        })
      } catch {
        /* ignore polling errors */
      }
    }

    load()
    const t = setInterval(load, POLL_INTERVAL_MS)
    const handler = () => load()
    window.addEventListener(WALLET_CHANGED_EVENT, handler)
    return () => {
      cancelled = true
      clearInterval(t)
      window.removeEventListener(WALLET_CHANGED_EVENT, handler)
    }
  }, [])

  return (
    <Link
      href="/inbox"
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
      aria-label={count > 0 ? `${count} unread notifications` : "Inbox"}
    >
      <Bell className="w-5 h-5" />
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold bg-rose-600 text-white flex items-center justify-center px-1">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  )
}

async function maybeBrowserNotify(address: string, count: number) {
  try {
    if (typeof Notification === "undefined") return
    if (Notification.permission !== "granted") return
    const key = BROWSER_NOTIFICATION_KEY + ":" + address.toLowerCase()
    const prior = Number(window.localStorage.getItem(key) ?? "0")
    if (count <= prior) return
    window.localStorage.setItem(key, String(count))
    new Notification("NDA Sentinel", {
      body: `${count} unread notification${count === 1 ? "" : "s"} in your inbox.`,
      icon: "/favicon.ico",
    })
  } catch {
    /* ignore */
  }
}
