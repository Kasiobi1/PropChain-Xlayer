import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

export default function AboutPage() {
  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <div className="flex-1">
        <header className="flex items-center gap-3 border-b border-hairline-dark bg-ink px-4 py-4 sm:px-8">
          <MobileNav />
          <Link href="/" className="font-display text-xl italic text-white">
            PropChain
          </Link>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
          <Link href="/" className="text-xs text-text-secondary hover:text-white">
            ← Back to Browse
          </Link>

          <h1 className="mt-4 font-display text-3xl text-white">What is PropChain?</h1>

          <div className="mt-6 space-y-4 text-sm leading-relaxed text-text-secondary">
            <p>
              PropChain is a marketplace for tokenizing real-world assets — houses, land,
              phones, and gadgets — as NFTs. Every listing passes through AI-driven document
              and identity verification before it can ever be minted, so what you see on the
              marketplace has already been checked, not just claimed.
            </p>
            <p>
              Ownership documents, survey plans, and identity checks are verified off-chain,
              then a hash of the underlying documentation is stored on-chain. Anyone can
              confirm that hash hasn&apos;t changed since the asset was approved — without
              needing to trust a middleman&apos;s word for it.
            </p>
            <p>
              PropChain is being built on X Layer, OKX&apos;s Ethereum L2, with support for
              buying across ETH, Base, and X Layer. It started as a submission for the OKX
              BuildX AI Season Hackathon and is under active development — pricing,
              negotiation, and escrow all run through audited smart contracts, currently
              live on testnet.
            </p>
          </div>

          <div className="mt-10 flex gap-4 border-t border-hairline-dark pt-6">
            <Link
              href="/guides/list-an-asset"
              className="text-xs font-medium text-white underline underline-offset-4"
            >
              How to list a prop
            </Link>
            <Link
              href="/guides/buy-an-asset"
              className="text-xs font-medium text-white underline underline-offset-4"
            >
              How to buy a prop
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
