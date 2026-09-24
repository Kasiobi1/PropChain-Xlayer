"use client";

import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { NetworkToggle } from "@/components/NetworkToggle";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import { ListingRow } from "@/components/ListingRow";
import { SiteFooter } from "@/components/SiteFooter";
import { MOCK_LISTINGS } from "@/lib/mockListings";
import { useActiveNetwork } from "@/lib/useActiveNetwork";

const FEATURED_TOKEN_IDS = [7, 1, 5];
const FEATURED_LISTINGS = FEATURED_TOKEN_IDS.map((id) =>
  MOCK_LISTINGS.find((l) => l.tokenId === id)
).filter((l): l is (typeof MOCK_LISTINGS)[number] => !!l);

const VALUE_PROPS = [
  {
    title: "Two tiers of verification",
    body: "Every asset clears AI document and identity verification before it's ever minted — marked with a gray seal. Organizations we've personally confirmed carry a blue seal instead, on top of the same AI check.",
  },
  {
    title: "Proof lives on-chain",
    body: "A hash of the underlying documentation is stored on-chain — anyone can confirm it hasn't changed since approval, no middleman required.",
  },
  {
    title: "Fully traceable",
    body: "Paste any wallet address to see its real buy/sell history, or open any asset to see its complete transfer record — every movement, on-chain, verifiable by anyone.",
  },
  {
    title: "Built for X Layer",
    body: "PropChain runs natively on X Layer — trade real-world assets with settlement on OKX's L2.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Submit documents",
    body: "Sellers upload proof of ownership — a deed, Certificate of Occupancy, receipt, or serial number — plus a government ID.",
  },
  {
    step: "02",
    title: "AI verification",
    body: "Documents and identity are checked for authenticity and matched against the seller before anything is minted. Typically 3–5 hours.",
  },
  {
    step: "03",
    title: "Mint & list",
    body: "Once verified, the asset is minted as an NFT with a hash of the documentation stored on-chain, then listed at a floor price.",
  },
  {
    step: "04",
    title: "Buy or negotiate",
    body: "Buyers can purchase at the listed price (choosing a quantity when multiple identical units are available), make an offer, or use hold-and-inspect escrow for higher-value assets before committing.",
  },
];

export default function LandingPage() {
  const network = useActiveNetwork();
  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-hairline-dark bg-ink px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <MobileNav />
            <span className="font-display text-xl italic text-white">PropChain</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-seal-gold-soft/40 bg-seal-gold-soft/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-seal-gold-soft">
              ⚡ Built on X Layer
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NetworkToggle />
            <ConnectWalletButton />
          </div>
        </header>

        {/* Hero */}
        <div className="px-4 pt-10 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-seal-gold-soft">
            X Layer {network === "mainnet" ? "Mainnet" : "Testnet"} · AI-verified RWA marketplace
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl italic leading-tight text-white sm:text-5xl">
            Real-world assets, tokenized — and checked before they're for sale.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
            Houses, land, phones, gadgets. PropChain runs every listing through AI document and
            identity verification before it's ever minted, so what you see has already been
            checked, not just claimed.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/browse"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-85"
            >
              Browse assets
            </Link>
            <Link
              href="/about"
              className="rounded-full border border-white/25 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black"
            >
              How it works
            </Link>
          </div>
        </div>

        {/* Slideshow — top-line stats/promos, same component as Browse */}
        <div className="px-4 pt-10 sm:px-8">
          <HeroSlideshow />
        </div>

        {/* Value props */}
        <section className="border-b border-hairline-dark px-4 py-12 sm:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_PROPS.map((prop) => (
              <div key={prop.title}>
                <h2 className="font-display text-lg text-white">{prop.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{prop.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-hairline-dark px-4 py-12 sm:px-8">
          <h2 className="font-display text-2xl text-white">How it works</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="rounded-xl border border-hairline-dark bg-surface p-5">
                <span className="font-mono text-xs text-seal-gold-soft">{item.step}</span>
                <h3 className="mt-2 text-sm font-medium text-white">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="border-b border-hairline-dark px-4 py-12 sm:px-8">
          <h2 className="font-display text-2xl text-white">Pricing</h2>
          <p className="mt-2 max-w-lg text-sm text-text-secondary">
            No listing fees, no minting fees — just network gas. PropChain only takes a cut when
            an asset actually sells.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-hairline-dark bg-surface p-6">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Listing & minting</p>
              <p className="mt-2 font-display text-3xl text-white">Free</p>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                Verification, minting, and listing an asset costs nothing beyond standard network
                gas fees on Base.
              </p>
            </div>
            <div className="rounded-xl border border-hairline-dark bg-surface p-6">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Platform fee on sale</p>
              <p className="mt-2 font-display text-3xl text-white">2.5%</p>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                Taken only when a sale completes, capped at 10% by the smart contract itself —
                the fee rate can&apos;t be raised past that on-chain.
              </p>
            </div>
          </div>
        </section>

        {/* Featured listings */}
        <section className="px-4 py-12 sm:px-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-white">Featured listings</h2>
            <Link href="/browse" className="text-xs text-text-secondary hover:text-white">
              Browse all →
            </Link>
          </div>
          <div className="mt-6 divide-y divide-hairline-dark rounded-xl border border-hairline-dark">
            {FEATURED_LISTINGS.map((listing, i) => (
              <ListingRow key={listing.tokenId} listing={listing} index={i} />
            ))}
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}
