import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

const STEPS = [
  {
    title: "Connect your wallet",
    body: "Connect the wallet that will hold your asset's NFT once it's minted.",
  },
  {
    title: "Submit your documents",
    body: "Upload proof of ownership — a Certificate of Occupancy or Deed of Assignment for property, a receipt and serial number for gadgets — along with a government ID.",
  },
  {
    title: "AI verification",
    body: "Our verification pipeline checks document authenticity, matches your name against the documents, and confirms your identity via a liveness check. This typically takes 3–5 hours.",
  },
  {
    title: "Minting",
    body: "Once verified, your asset is minted as an NFT with a hash of your documentation stored on-chain. Only verified assets can ever be minted — there's no way to list an unverified asset.",
  },
  {
    title: "Set your price",
    body: "Set a floor price and let PropChain's Best Floor Price (BFP) system track offers and market movement, or set a fixed price for instant buy-now.",
  },
];

export default function ListAssetGuidePage() {
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

          <h1 className="mt-4 font-display text-3xl text-white">How to list a prop</h1>
          <p className="mt-3 text-sm text-text-secondary">
            Every asset on PropChain is AI-verified before it can be minted. Here&apos;s the
            process, start to finish.
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
              Listing flow and wallet integration are still being wired up — this page
              describes how it will work once live on X Layer testnet.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
