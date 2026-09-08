import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SnapsBypassInitializer } from "@/components/SnapsBypassInitializer";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NDA Sentinel — Trustless NDA enforcement on GenLayer",
  description:
    "AI Jury reads the suspect URL on-chain and reaches consensus on the verdict; the contract slashes and distributes stakes atomically. No $200k lawsuits, no 24-month waits.",
  metadataBase: new URL("https://nda-sentinel-ppp-df6a.vercel.app"),
  openGraph: {
    title: "NDA Sentinel — Trustless NDA enforcement on GenLayer",
    description:
      "AI Jury adjudicates NDA leaks on-chain via GenLayer consensus. Multi-source fetch + reputation + structured appeals.",
    url: "https://nda-sentinel-ppp-df6a.vercel.app",
    siteName: "NDA Sentinel",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-[#FBFBFD] dark:bg-[#0B0D12] text-slate-900 dark:text-slate-100 font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <div className="flex flex-col min-h-screen">
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
              >
                Skip to main content
              </a>
              <SnapsBypassInitializer />
              <SiteHeader />
              <main id="main-content" className="flex-1 flex flex-col" role="main">
                {children}
              </main>
              <SiteFooter />
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
