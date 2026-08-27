import { Button } from "@/components/ui/button"
import {
  Shield,
  BrainCircuit,
  Zap,
  Users,
  Code,
  Scale,
  AlertTriangle,
  FileSignature,
  CheckCircle2,
  Gavel,
  Coins,
  BadgeCheck,
  Globe,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Clock,
  Wallet,
  Timer,
  Layers,
  CircleDot,
} from "lucide-react"
import Link from "next/link"
import { fetchProtocolStats } from "@/lib/onchain-stats"
import { CONTRACT_ADDRESS, STUDIONET_EXPLORER_URL } from "@/lib/genlayer"

export const revalidate = 60

export default async function Home() {
  const stats = await fetchProtocolStats()
  const explorerUrl = `${STUDIONET_EXPLORER_URL}/address/${CONTRACT_ADDRESS}`

  const statCards = [
    {
      label: "NDAs on-chain",
      value: stats.totalNdas.toLocaleString(),
      hint: "Created via create_nda",
    },
    {
      label: "Leaks confirmed",
      value: stats.violationsConfirmed.toLocaleString(),
      hint: "AI Jury verdict = leak",
    },
    {
      label: "GEN slashed",
      value: stats.totalSlashedGen.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }),
      hint: "80/17/3 to reporter/party/treasury",
    },
    {
      label: "Appeal outcomes",
      value: `${stats.appealsOverturned} / ${stats.appealsUpheld}`,
      hint: "overturned / upheld",
    },
    {
      label: "Timeline events",
      value: stats.events.toLocaleString(),
      hint: "get_events_for_nda",
    },
    {
      label: "Treasury (GEN)",
      value: stats.treasuryGen.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }),
      hint: "Protocol fees escrowed",
    },
  ]

  return (
    <>
      {/* HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-rose-50 dark:from-purple-950/40 dark:via-[#0B0D12] dark:to-rose-950/20"
          aria-hidden
        />
        <div className="pointer-events-none absolute -top-32 -right-24 w-[520px] h-[520px] rounded-full bg-purple-400/25 dark:bg-purple-500/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 -left-24 w-[520px] h-[520px] rounded-full bg-rose-300/25 dark:bg-rose-500/10 blur-3xl" aria-hidden />

        <div className="relative mx-auto max-w-7xl px-4 md:px-6 pt-16 pb-14 md:pt-24 md:pb-20">
          <div className="grid gap-10 lg:grid-cols-[1.15fr,1fr] lg:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 dark:border-purple-800 bg-white/70 dark:bg-purple-950/40 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-200">
                <Sparkles className="w-3.5 h-3.5" />
                Live on GenLayer studionet · v0.2.20
              </div>
              <h1 className="mt-4 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white">
                NDA enforcement
                <br />
                at the speed of <span className="text-purple-600">consensus</span>.
              </h1>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 max-w-xl">
                An AI Jury of GenLayer validators reads the suspect URL directly
                on-chain and agrees on the verdict. The contract slashes and
                distributes stakes atomically. No $200k lawsuits. No 24-month waits.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/ndas/new">
                  <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white h-11">
                    <FileSignature className="w-4 h-4 mr-2" />
                    Create NDA
                  </Button>
                </Link>
                <Link href="/report">
                  <Button size="lg" variant="destructive" className="h-11">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Report a Leak
                  </Button>
                </Link>
                <Link href="/violations">
                  <Button variant="outline" size="lg" className="h-11">
                    See live verdicts
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <CircleDot className="w-3 h-3 text-emerald-500" />
                  {stats.live ? "Live RPC · updated on load" : "RPC unreachable — showing 0"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-purple-500" />
                  Commit-reveal keeps secrets off-chain
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-rose-500" />
                  Multi-source fetch (Primary + Wayback + Google)
                </span>
              </div>
            </div>

            {/* Hero side card */}
            <div className="relative">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 backdrop-blur shadow-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="ml-2">NDASentinel.report_leak(...)</span>
                </div>
                <div className="p-5 grid grid-cols-2 gap-3">
                  {statCards.map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 p-3"
                    >
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        {s.label}
                      </div>
                      <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                        {s.value}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5">
                        {s.hint}
                      </div>
                    </div>
                  ))}
                </div>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block px-5 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                >
                  Verify on-chain — Explorer contract page →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM ──────────────────────────────────────────────────── */}
      <section className="w-full py-16 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-widest font-semibold text-purple-600 dark:text-purple-400">
              The problem
            </p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
              NDAs are unenforceable in practice.
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              A signed piece of paper. Zero enforcement rails. Any breach turns into a
              paid legal argument that outlives the leak by years.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: <ShieldAlert className="w-5 h-5" />,
                stat: "$200k – $2M",
                title: "Cost of enforcement",
                body: "Discovery, depositions, motions. The alleged victim pays before anyone reads the leak.",
              },
              {
                icon: <Clock className="w-5 h-5" />,
                stat: "18 – 36 months",
                title: "Median resolution",
                body: "By the time a court rules, the trade secret, roadmap, or deal pricing is stale.",
              },
              {
                icon: <Scale className="w-5 h-5" />,
                stat: "Judgment ≠ collection",
                title: "Winning is not remedy",
                body: "A default judgment is a piece of paper unless the losing party has attachable assets.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 p-5"
              >
                <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 flex items-center justify-center">
                  {c.icon}
                </div>
                <div className="mt-3 text-sm font-mono text-rose-600 dark:text-rose-300">
                  {c.stat}
                </div>
                <div className="mt-1 font-semibold">{c.title}</div>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS ─────────────────────────────────────────────── */}
      <section id="how" className="w-full py-16 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-widest font-semibold text-purple-600 dark:text-purple-400">How it works</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
              Five steps. One contract. Zero courts.
            </h2>
          </div>
          <ol className="grid gap-5 md:grid-cols-5">
            {[
              {
                n: "1",
                icon: <FileSignature className="w-5 h-5" />,
                title: "Create",
                body: "Party A commits sha256 of every protected keyword + salt, stakes GEN, and picks the counterparty.",
                href: "/ndas/new",
                cta: "Create NDA",
              },
              {
                n: "2",
                icon: <CheckCircle2 className="w-5 h-5" />,
                title: "Activate",
                body: "Party B matches the stake within the window. Both parties are now on the hook.",
                href: "/ndas",
                cta: "My NDAs",
              },
              {
                n: "3",
                icon: <AlertTriangle className="w-5 h-5" />,
                title: "Report",
                body: "Either side flags a suspect URL and re-supplies the salt. The 1 GEN report fee funds gas.",
                href: "/report",
                cta: "Report a leak",
                highlight: true,
              },
              {
                n: "4",
                icon: <BrainCircuit className="w-5 h-5" />,
                title: "AI Jury",
                body: "Validators fetch PRIMARY + WAYBACK + GOOGLE inside eq_principle.prompt_comparative and agree on the verdict.",
              },
              {
                n: "5",
                icon: <Gavel className="w-5 h-5" />,
                title: "Slash / Appeal",
                body: "7-day appeal on structured grounds. Otherwise escrow splits 80/17/3 to reporter / non-violator / treasury.",
                href: "/violations",
                cta: "Verdicts log",
              },
            ].map((step) => (
              <li
                key={step.n}
                className={`relative rounded-xl border p-5 flex flex-col gap-3 bg-white dark:bg-slate-950/60 ${
                  step.highlight
                    ? "border-rose-300 dark:border-rose-800 ring-1 ring-rose-200 dark:ring-rose-900"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                      step.highlight
                        ? "bg-rose-600 text-white"
                        : "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-200"
                    }`}
                  >
                    {step.n}
                  </span>
                  {step.icon}
                  <span>{step.title}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 flex-1">
                  {step.body}
                </p>
                {step.href && step.cta ? (
                  <Link
                    href={step.href}
                    className={`text-xs font-medium inline-flex items-center gap-1 ${
                      step.highlight
                        ? "text-rose-700 dark:text-rose-300"
                        : "text-purple-700 dark:text-purple-300"
                    }`}
                  >
                    {step.cta} <ArrowRight className="w-3 h-3" />
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* LIVE VERDICTS ────────────────────────────────────────────── */}
      <section className="w-full py-16 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold text-purple-600 dark:text-purple-400">On-chain right now</p>
              <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
                Live protocol state.
              </h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
                Every number below comes from a fresh <code className="font-mono text-xs px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900">gen_call</code> to studionet at page load — nothing is hardcoded.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/violations">
                <Button variant="outline">Verdicts log</Button>
              </Link>
              <a href={explorerUrl} target="_blank" rel="noreferrer">
                <Button variant="outline">
                  Open on Explorer <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {statCards.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-950/60"
              >
                <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {s.label}
                </div>
                <div className="mt-1 text-3xl font-bold">{s.value}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                  {s.hint}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-3 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-slate-500">contract</span>
            <a href={explorerUrl} target="_blank" rel="noreferrer" className="font-mono text-purple-600 dark:text-purple-400 hover:underline break-all">
              {CONTRACT_ADDRESS}
            </a>
            <span className="text-slate-400">·</span>
            <span>network <b className="text-slate-700 dark:text-slate-200">studionet</b></span>
            <span className="text-slate-400">·</span>
            <span>class <b className="text-slate-700 dark:text-slate-200 font-mono">NDASentinel</b></span>
            <span className="text-slate-400">·</span>
            <span>pragma <b className="text-slate-700 dark:text-slate-200 font-mono">v0.2.20</b></span>
          </div>
        </div>
      </section>

      {/* SIGNALS / AI JURY DETAILS ────────────────────────────────── */}
      <section className="w-full py-16 border-t border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white to-purple-50/60 dark:from-[#0B0D12] dark:to-purple-950/20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-widest font-semibold text-purple-600 dark:text-purple-400">Consensus signals</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
              Validators check meaning, not schema.
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Two validators may phrase a rationale differently and still agree the leak is real.
              Two validators who disagree on the <em>verdict</em> block the transaction. That is the
              GenLayer-specific consensus your dispute needs.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Globe className="w-5 h-5" />,
                title: "Multi-source fetch",
                body: "leader_fn pulls PRIMARY + WAYBACK archive + GOOGLE cache inside prompt_comparative. Validators must agree on sources_confirming ± 1.",
              },
              {
                icon: <BrainCircuit className="w-5 h-5" />,
                title: "Semantic equivalence",
                body: "eq_principle.prompt_comparative compares verdicts by meaning — free-text rationale is allowed to differ, verdict is not.",
              },
              {
                icon: <BadgeCheck className="w-5 h-5" />,
                title: "Publisher identity",
                body: "register_publisher_identity ties handles to addresses via an on-chain LLM proof-page fetch. Attribution is grounded in a verified handle.",
              },
              {
                icon: <Gavel className="w-5 h-5" />,
                title: "Structured appeals",
                body: "appeal() takes an enum ground (PRIOR_DISCLOSURE / ATTRIBUTION_ERROR / KEYWORD_MISMATCH) + evidence URL + timestamp — enforced by the contract.",
              },
              {
                icon: <Layers className="w-5 h-5" />,
                title: "Reputation ledger",
                body: "Every address has an on-chain score. Confirmed reports reward; false accusations bite harder than a single win earns.",
              },
              {
                icon: <Timer className="w-5 h-5" />,
                title: "Event log",
                body: "get_events_for_nda replays the full lifecycle — 11 event kinds — for the frontend timeline. No off-chain log service.",
              },
              {
                icon: <Shield className="w-5 h-5" />,
                title: "Commit-reveal privacy",
                body: "Only sha256(keyword + salt) hits the chain. Secrets live in the reporter's vault file until a leak is filed.",
              },
              {
                icon: <Coins className="w-5 h-5" />,
                title: "Payment conservation",
                body: "get_nda_liabilities exposes the invariant: escrow + stakes + withdrawables + treasury conserves value across every state transition.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-5"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                  {f.icon}
                </div>
                <div className="mt-3 font-semibold">{f.title}</div>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ARCHITECTURE ─────────────────────────────────────────────── */}
      <section className="w-full py-16 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-widest font-semibold text-purple-600 dark:text-purple-400">Architecture</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
              Frontend → contract → validators → back.
            </h2>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-6 md:p-8 overflow-x-auto">
            <pre className="text-[11px] md:text-xs font-mono leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre">{`   Party A / Party B
   (MetaMask · studionet chainId 61999)
            │
            ▼
   ┌──────────────────────────────────────┐
   │  Next.js dApp  (genlayer-js v1.1.8)  │
   │  · wallet_switchEthereumChain        │
   │  · commit-reveal keyword hashes      │
   │  · vault file (password-encrypted)   │
   └──────────────────────────────────────┘
            │  createClient({ chain: studionet, account })
            ▼
   ┌──────────────────────────────────────┐
   │  NDASentinel  (Intelligent Contract) │
   │  · create_nda / activate / cancel    │
   │  · report_leak → gl.vm.run_nondet    │
   │  · appeal (enum + URL + timestamp)   │
   │  · reputation + event log            │
   └──────────────────────────────────────┘
            │  eq_principle.prompt_comparative(leader_fn, principle=...)
            ▼
   ┌──────────────────────────────────────┐
   │  Validators (Optimistic Democracy)   │
   │  leader_fn:                          │
   │    ├─ gl.nondet.web.render(primary)  │
   │    ├─ gl.nondet.web.render(wayback)  │
   │    ├─ gl.nondet.web.render(google)   │
   │    └─ gl.nondet.exec_prompt(json)    │
   │  validator: verdict + sources ±1     │
   └──────────────────────────────────────┘
            │  agreed verdict → state write
            ▼
   Escrow splits 80 / 17 / 3 → reporter / non-violator / treasury
   Event log appended → frontend timeline refreshes`}
</pre>
          </div>
        </div>
      </section>

      {/* USE CASES ────────────────────────────────────────────────── */}
      <section className="w-full py-16 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-widest font-semibold text-purple-600 dark:text-purple-400">Who this is for</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
              Built for parties with something to lose.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Users className="w-5 h-5" />,
                title: "M&A Advisors",
                body: "Deal pricing, buyer lists, target IDs. A leaked term sheet costs the client — not the leaker — under a paper NDA.",
              },
              {
                icon: <Code className="w-5 h-5" />,
                title: "Tech Startups",
                body: "Source code, roadmap slides, model weights. Fast slashing beats a 2-year suit against a former employee.",
              },
              {
                icon: <Scale className="w-5 h-5" />,
                title: "Litigation Settlements",
                body: "Confidentiality clauses in settlements are only worth the enforcement rails behind them. This is the rail.",
              },
              {
                icon: <Sparkles className="w-5 h-5" />,
                title: "AI Data Partners",
                body: "Vendor is asked to hold benchmark prompts confidential. Publish them, forfeit the stake.",
              },
            ].map((u) => (
              <div
                key={u.title}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-5"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  {u.icon}
                </div>
                <div className="mt-3 font-semibold">{u.title}</div>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                  {u.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARE ─────────────────────────────────────────────────── */}
      <section className="w-full py-16 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-widest font-semibold text-purple-600 dark:text-purple-400">Compare</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
              Traditional NDA vs NDA Sentinel.
            </h2>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left font-medium px-5 py-3 w-1/3">Dimension</th>
                  <th className="text-left font-medium px-5 py-3">Traditional paper NDA</th>
                  <th className="text-left font-medium px-5 py-3">NDA Sentinel on GenLayer</th>
                </tr>
              </thead>
              <tbody className="[&>tr:not(:last-child)]:border-b [&>tr]:border-slate-200 dark:[&>tr]:border-slate-800">
                {[
                  ["Enforcement cost", "$200k – $2M in legal fees", "1 GEN report fee + gas"],
                  ["Time to remedy", "18 – 36 months", "30 s – 3 min consensus + 7-day appeal"],
                  ["Who decides", "Judge or arbitrator, months later", "AI Jury of validators, semantically"],
                  ["Evidence source", "Discovery + subpoenas", "Multi-source web fetch on-chain"],
                  ["Payout", "Judgment ≠ collection", "Escrow slashes atomically, 80/17/3"],
                  ["Privacy", "Sealed filings, still leaked", "Only sha256(keyword + salt) on-chain"],
                  ["Bad-faith reporter", "Chilling counter-suit", "1 GEN fee + reputation penalty"],
                ].map(([dim, oldw, neww]) => (
                  <tr key={dim} className="bg-white dark:bg-slate-950/60">
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">{dim}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{oldw}</td>
                    <td className="px-5 py-3 text-slate-800 dark:text-slate-100">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        {neww}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* HOW TO USE ──────────────────────────────────────────────── */}
      <section className="w-full py-16 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-widest font-semibold text-purple-600 dark:text-purple-400">For reviewers</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">How to try it in 3 steps.</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              You need a MetaMask wallet on studionet with a few GEN. Fund from
              <span className="mx-1 font-mono">Studio → Accounts</span>
              — the public testnet faucet is a different chain and will not work.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                n: "1",
                icon: <Wallet className="w-5 h-5" />,
                title: "Connect MetaMask",
                body: "Open any page and click Connect MetaMask. The app calls wallet_switchEthereumChain and adds studionet automatically.",
                href: "/ndas",
                cta: "Open dashboard",
              },
              {
                n: "2",
                icon: <FileSignature className="w-5 h-5" />,
                title: "Create or open an NDA",
                body: "Use the wizard to draft an NDA and stake GEN, or look up an existing NDA by ID if a counterparty shared one with you.",
                href: "/ndas/new",
                cta: "Create NDA",
              },
              {
                n: "3",
                icon: <AlertTriangle className="w-5 h-5" />,
                title: "Report a suspect URL",
                body: "Paste the URL you believe leaks a keyword and re-enter your salt file. The AI Jury verdict + rationale lands in ~30 s – 3 min.",
                href: "/report",
                cta: "Report a leak",
              },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-5 flex flex-col">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-600 text-white text-xs font-bold">
                    {s.n}
                  </span>
                  {s.icon}
                  {s.title}
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 flex-1">
                  {s.body}
                </p>
                <Link href={s.href} className="mt-4">
                  <Button variant="outline" className="w-full">
                    {s.cta} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ ─────────────────────────────────────────────────────── */}
      <section className="w-full py-16 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-widest font-semibold text-purple-600 dark:text-purple-400">FAQ</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
              The short version.
            </h2>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/60">
            {[
              {
                q: "Does anything confidential leave my browser?",
                a: "No. The wizard hashes each keyword with sha256(keyword + salt) locally and only the hex hash goes on-chain. The salt file stays with you — losing it means you can never file a leak report against your own NDA.",
              },
              {
                q: "What stops a bad-faith reporter?",
                a: "Reporting costs 1 GEN and, on a false accusation, hits reputation harder than a single successful report earns. Overturned appeals return the appellant's stake and re-slash the reporter.",
              },
              {
                q: "How does the AI Jury actually 'read' the leak?",
                a: "The leader_fn calls gl.nondet.web.render on the primary URL, its Wayback archive, and a Google cache snapshot, then asks the LLM for a JSON verdict. eq_principle.prompt_comparative accepts differing rationales but rejects differing verdicts or a sources_confirming count that drifts by more than 1.",
              },
              {
                q: "Can I appeal a verdict?",
                a: "Yes, within 7 days, on one of three enum grounds — PRIOR_DISCLOSURE, ATTRIBUTION_ERROR, KEYWORD_MISMATCH — with an evidence URL and timestamp. The contract enforces the shape; the AI Jury re-adjudicates the content.",
              },
              {
                q: "Is 'studionet' the same as testnet?",
                a: "No. Studionet is the hosted GenLayer Studio environment. Testnets (Asimov, Bradbury) are separate chains with their own faucets; a contract deployed on studionet does not exist there. This project is intentionally on studionet only.",
              },
              {
                q: "Where do I fund the demo wallet?",
                a: "Open Studio → Accounts, pick a pre-funded account, and transfer GEN to your MetaMask address. The public testnet faucet is a different chain and will not credit you here.",
              },
            ].map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{f.q}</span>
                  <span className="text-slate-400 group-open:rotate-45 transition text-lg leading-none">+</span>
                </summary>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA ───────────────────────────────────────────────── */}
      <section className="w-full py-20 border-t border-slate-200 dark:border-slate-800 bg-gradient-to-br from-purple-600 to-purple-800 text-white">
        <div className="mx-auto max-w-4xl px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Test the enforcement path in your browser.
          </h2>
          <p className="mt-3 text-purple-100 max-w-2xl mx-auto">
            Open an NDA, report a leak, watch the AI Jury deliberate on-chain, and read the verdict rationale — from a single dApp.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/ndas/new">
              <Button size="lg" className="bg-white text-purple-700 hover:bg-purple-50 h-11">
                <FileSignature className="w-4 h-4 mr-2" />
                Create NDA
              </Button>
            </Link>
            <Link href="/report">
              <Button size="lg" variant="destructive" className="h-11 bg-rose-500 hover:bg-rose-600">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Report a leak
              </Button>
            </Link>
            <Link href="/violations">
              <Button size="lg" variant="outline" className="h-11 border-white/30 text-white hover:bg-white/10">
                Live verdicts
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
