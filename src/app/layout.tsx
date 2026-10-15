import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Utensils, Coins, Sparkles, User, MapPin } from "lucide-react";
import JudgeDemoBar from "@/components/JudgeDemoBar";

export const metadata: Metadata = {
  title: "TasteChain BKK — The AI-Powered Web3 Gastronomy Protocol",
  description:
    "Decentralized Bangkok F&B discovery with ElevenLabs AI Shop Voices, Proof-of-Visit Oracle, and $TASTE Real-Yield Tokenomics.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" data-theme="dark">
      <body className="min-h-screen flex flex-col bg-[#0D0F12] text-slate-100">
        {/* Navbar */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0D0F12]/90 border-b border-[#21262D]">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 font-bold text-xl group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-avax-red to-orange-500 flex items-center justify-center shadow-lg shadow-avax-red/20 group-hover:scale-105 transition-transform">
                <Utensils className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="leading-tight tracking-tight text-white flex items-center gap-1.5">
                  TasteChain <span className="text-xs px-1.5 py-0.5 rounded bg-avax-red/20 text-avax-red font-semibold border border-avax-red/30">BKK</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Avalanche C-Chain (Fuji)</span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="hover:text-avax-red transition-colors flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-avax-red" />
                สำรวจ 36K+ ร้าน
              </Link>
              <Link href="/mining" className="hover:text-taste-gold transition-colors flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-taste-gold" />
                กองกลาง 10K $TASTE
              </Link>
            </nav>

            {/* Actions & Judge Demo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-sm bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold border-none shadow-md shadow-orange-500/20 flex items-center gap-1.5"
                title="1-Click Judge Demo Mode"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>⚡ Judge Demo</span>
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline border-[#30363D] hover:bg-[#21262D] text-slate-200"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Connect Wallet</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-[#21262D] bg-[#161B22] py-8 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-slate-300 font-semibold">TasteChain BKK</span> — Powered by Avalanche C-Chain & ElevenLabs AI
            </div>
            <div className="flex items-center gap-4">
              <span>PostgreSQL 17: 36,369 F&B Venues</span>
              <span>•</span>
              <a
                href="https://testnet.snowtrace.io"
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-300 underline"
              >
                Snowtrace Fuji
              </a>
              <span>•</span>
              <a
                href="https://github.com/0xta/Uhackathon2026"
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-300 underline"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>

        {/* 1-Click Judge Guided Demo Bar */}
        <JudgeDemoBar />
      </body>
    </html>
  );
}
