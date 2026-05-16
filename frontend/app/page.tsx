import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Shield, BrainCircuit, Zap, Users, Code, Scale } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex h-16 items-center px-6 border-b bg-white dark:bg-[#13161D]">
        <div className="flex items-center gap-2 font-bold text-xl">
          <Shield className="h-6 w-6 text-purple-600" />
          <span>NDA Sentinel</span>
        </div>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link href="/ndas" className="text-sm font-medium hover:underline underline-offset-4">
            Dashboard
          </Link>
          <Link href="/violations" className="text-sm font-medium hover:underline underline-offset-4">
            Violations Log
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-purple-50 dark:bg-purple-950/20">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  NDA enforcement at the speed of consensus
                </h1>
                <p className="mx-auto max-w-[700px] text-slate-500 md:text-xl dark:text-slate-400">
                  AI Jury detects leaks. Smart contracts slash violators. No $200k lawsuits. No 2-year waits.
                </p>
              </div>
              <div className="space-x-4">
                <Link href="/ndas/new">
                  <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white">
                    Create NDA
                  </Button>
                </Link>
                <Link href="/ndas">
                  <Button variant="outline" size="lg">
                    View My NDAs
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-8 sm:grid-cols-3">
              <Card className="border-0 shadow-none bg-transparent">
                <CardContent className="flex flex-col items-center text-center space-y-4 p-6">
                  <div className="p-4 bg-purple-100 dark:bg-purple-900/50 rounded-full">
                    <Shield className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold">Commit-Reveal Privacy</h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Your confidential terms never go on-chain. Only cryptographic hashes are stored. Secrets stay in your browser.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-none bg-transparent">
                <CardContent className="flex flex-col items-center text-center space-y-4 p-6">
                  <div className="p-4 bg-emerald-100 dark:bg-emerald-900/50 rounded-full">
                    <BrainCircuit className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold">AI Jury Verification</h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    GenLayer validators run intelligent consensus to semantically evaluate suspected leaks against your protected terms.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-none bg-transparent">
                <CardContent className="flex flex-col items-center text-center space-y-4 p-6">
                  <div className="p-4 bg-rose-100 dark:bg-rose-900/50 rounded-full">
                    <Zap className="h-8 w-8 text-rose-600 dark:text-rose-400" />
                  </div>
                  <h3 className="text-xl font-bold">Automated Slashing</h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Violators automatically lose their staked GEN collateral. The reporter is immediately rewarded. Trustless enforcement.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 bg-slate-50 dark:bg-slate-900/50">
          <div className="container px-4 md:px-6 mx-auto text-center space-y-12">
            <h2 className="text-3xl font-bold tracking-tighter">Built for Modern Businesses</h2>
            <div className="grid gap-8 sm:grid-cols-3">
              <div className="flex flex-col items-center space-y-2">
                <Users className="h-10 w-10 text-slate-400" />
                <h4 className="font-bold">M&A Advisors</h4>
                <p className="text-sm text-slate-500">Protect deal pricing and buyer lists.</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <Code className="h-10 w-10 text-slate-400" />
                <h4 className="font-bold">Tech Startups</h4>
                <p className="text-sm text-slate-500">Secure source code and product roadmaps.</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <Scale className="h-10 w-10 text-slate-400" />
                <h4 className="font-bold">Litigation</h4>
                <p className="text-sm text-slate-500">Enforce out-of-court settlement privacy.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          © 2026 NDA Sentinel. Powered by GenLayer.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Contract: {process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.substring(0, 8)}...
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy Disclaimer
          </Link>
        </nav>
      </footer>
    </div>
  )
}
