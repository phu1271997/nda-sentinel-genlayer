import Link from "next/link"
import { Shield, ExternalLink } from "lucide-react"
import { CONTRACT_ADDRESS, STUDIONET_EXPLORER_URL } from "@/lib/genlayer"

const GITHUB_URL = "https://github.com/phu1271997/nda-sentinel-genlayer"
const EXPLORER_ADDRESS = `${STUDIONET_EXPLORER_URL}/address/${CONTRACT_ADDRESS}`

const cols: Array<{
  title: string
  links: Array<{ href: string; label: string; external?: boolean }>
}> = [
  {
    title: "Product",
    links: [
      { href: "/ndas/new", label: "Create NDA" },
      { href: "/report", label: "Report Leak" },
      { href: "/ndas", label: "My NDAs" },
      { href: "/violations", label: "Verdicts Log" },
      { href: "/identity", label: "Publisher Identity" },
    ],
  },
  {
    title: "Protocol",
    links: [
      { href: EXPLORER_ADDRESS, label: "Contract on Explorer", external: true },
      { href: "https://docs.genlayer.com/", label: "GenLayer Docs", external: true },
      { href: "https://studio.genlayer.com/contracts", label: "GenLayer Studio", external: true },
      { href: "https://genlayer.com/how-it-works", label: "How Consensus Works", external: true },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: `${GITHUB_URL}#readme`, label: "README", external: true },
      { href: `${GITHUB_URL}/blob/main/CHANGELOG.md`, label: "Changelog", external: true },
      { href: `${GITHUB_URL}/blob/main/SECURITY.md`, label: "Security Model", external: true },
      { href: `${GITHUB_URL}/tree/main/docs`, label: "Architecture Docs", external: true },
      { href: `${GITHUB_URL}/tree/main/tests`, label: "Test Suite", external: true },
    ],
  },
  {
    title: "Community",
    links: [
      { href: GITHUB_URL, label: "GitHub", external: true },
      { href: "https://discord.gg/8Jm4v89VAu", label: "GenLayer Discord", external: true },
      { href: "https://portal.genlayer.foundation/", label: "GenLayer Portal", external: true },
      { href: "https://genlayer-explorer.vercel.app", label: "Block Explorer", external: true },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-6">
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <Shield className="h-6 w-6 text-purple-600" />
              <span>NDA Sentinel</span>
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
              Trustless NDA enforcement. An AI Jury of GenLayer validators reads
              the suspect URL directly on-chain and agrees on a verdict; the
              contract slashes and distributes stakes atomically.
            </p>
            <div className="pt-2 text-xs text-slate-500 dark:text-slate-500 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="uppercase tracking-widest text-[10px] font-semibold text-slate-400">Network</span>
                <span className="font-mono text-slate-700 dark:text-slate-200">studionet · chainId 61999</span>
              </div>
              <div className="flex items-start gap-2 flex-wrap">
                <span className="uppercase tracking-widest text-[10px] font-semibold text-slate-400 pt-0.5">Contract</span>
                <a
                  href={EXPLORER_ADDRESS}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-purple-600 dark:text-purple-400 hover:underline break-all"
                >
                  {CONTRACT_ADDRESS}
                </a>
              </div>
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title} className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {col.title}
              </div>
              <ul className="space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noreferrer" : undefined}
                      className="text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 inline-flex items-center gap-1.5"
                    >
                      {l.label}
                      {l.external ? <ExternalLink className="w-3 h-3 opacity-60" /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-3 justify-between text-xs text-slate-500 dark:text-slate-500">
          <div>© 2026 NDA Sentinel · Powered by GenLayer · Deployed on studionet</div>
          <div className="flex items-center gap-4">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-purple-600 dark:hover:text-purple-400">
              <ExternalLink className="w-3.5 h-3.5" />
              GitHub
            </a>
            <span>·</span>
            <span>MIT License</span>
            <span>·</span>
            <span className="italic">Studio deploy → Explorer status: Preview</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
