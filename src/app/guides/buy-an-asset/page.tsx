import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

const STEPS = [
  {
    title: "Browse verified listings",
    body: "Every asset shown has already passed AI document and identity verification — you're never looking at an unverified claim.",
  },
  {
    title: "Check the verification panel",
    body: "Each listing page shows the on-chain document hash and verification ID, so you can confirm the underlying paperwork hasn't changed since approval.",
  },
  {
    title: "Buy now or make an offer",
    body: "Pay the listed price directly, or negotiate — sellers can accept, reject, or counter your offer.",
  },
  {
    title: "Hold-and-inspect (optional)",
    body: "For higher-value assets, funds can be held in escrow while you inspect the asset in person before confirming the purchase.",
  },
  {
    title: "Pay with ETH, Base, or X Layer",
    body: "PropChain settles across chains, so you're not limited to holding funds on a single network.",
  },
];

export default function BuyAssetGuidePage() {
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

          <h1 className="mt-4 font-display text-3xl text-white">How to buy a prop</h1>
          <p className="mt-3 text-sm text-text-secondary">
            Buying on PropChain works like buying on any NFT marketplace — with a
            verification layer underneath every listing.
          </p>

          <ol className="mt-8 space-y-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs text-white">
                  {i + 1}
                </span>
                <div>
                  <h2 className="font-display text-base text-white">{step.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 rounded-xl border border-hairline-dark bg-surface p-5">
            <p className="text-xs leading-relaxed text-text-secondary">
              Wallet connect and live purchases aren&apos;t wired up yet — this page describes
              how buying will work once live on X Layer testnet.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
