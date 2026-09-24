"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/walletConnect";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { NetworkToggle } from "@/components/NetworkToggle";
import { YIELD_ASSETS, type YieldAsset } from "@/lib/coins";

function YieldCard({
  asset,
  liveApy,
  selected,
  onSelect,
}: {
  asset: YieldAsset;
  liveApy: number | null;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${
        selected ? "border-white bg-surface" : "border-hairline-dark bg-surface/50 hover:border-white/30"
      }`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="font-display text-lg text-white">{asset.symbol}</span>
        {liveApy !== null && (
          <span className="rounded-full bg-sage/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-sage">
            Live
          </span>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-wide text-text-secondary">{asset.name}</p>
      <p key={liveApy ?? "range"} className="mt-3 animate-fade-in-up font-mono text-2xl font-medium text-sage">
        {liveApy !== null ? `${liveApy.toFixed(2)}%` : `${asset.apyRangeLow}–${asset.apyRangeHigh}%`}
      </p>
      <p className="mt-1 text-[11px] text-text-secondary">
        {liveApy !== null ? "Live APY, via Aave on X Layer" : "Estimated range, via Aave on X Layer"}
      </p>
    </button>
  );
}

export default function EarnPage() {
  const { connected: isConnected, address } = useWallet();
  const [selected, setSelected] = useState<YieldAsset>(YIELD_ASSETS[0]);
  const [amount, setAmount] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  // Live Aave rates, fetched from /api/aave-rates on load. Falls back to
  // the hardcoded estimated ranges in coins.ts if X Layer isn't found in
  // Aave's indexed API or the fetch fails — same pattern as Swap's live
  // price fetch. See /api/aave-rates/route.ts for the real uncertainty
  // here: this was built without the ability to test it against the live
  // API from this environment.
  const [liveRates, setLiveRates] = useState<Record<string, number> | null>(null);
  const [rateStatus, setRateStatus] = useState<"loading" | "live" | "fallback">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/aave-rates")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.found && data.rates && Object.keys(data.rates).length > 0) {
          setLiveRates(data.rates);
          setRateStatus("live");
        } else {
          setRateStatus("fallback");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRateStatus("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function getLiveApy(symbol: string): number | null {
    if (!liveRates) return null;
    // Aave lists wrapped ETH as WETH, not ETH.
    const key = symbol === "ETH" ? "WETH" : symbol;
    return liveRates[key] ?? null;
  }

  const selectedLiveApy = getLiveApy(selected.symbol);
  const estimatedApy = selectedLiveApy ?? (selected.apyRangeLow + selected.apyRangeHigh) / 2;
  const projectedYearly = amount ? (Number(amount) * estimatedApy) / 100 : 0;

  function handleSupply(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setFeedback("Enter an amount to supply first.");
      return;
    }
    if (!isConnected) {
      setFeedback("Connect a wallet to supply funds.");
      return;
    }
    setFeedback(
      `Wallet connected (${address?.slice(0, 6)}…${address?.slice(-4)}) — supplying ${amount} ${selected.symbol} isn't wired to a live contract yet.`
    );
  }

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-hairline-dark bg-ink px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <MobileNav />
            <Link href="/" className="font-display text-xl italic text-white">
              PropChain
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NetworkToggle />
            <ConnectWalletButton />
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
          <h1 className="animate-fade-in-up font-display text-3xl text-white">Earn</h1>
          <p className="mt-2 animate-fade-in-up text-sm text-text-secondary" style={{ animationDelay: "60ms" }}>
            Put idle funds to work instead of letting them sit in your balance. PropChain
            routes deposits into Aave&apos;s lending market on X Layer — you keep custody, and
            yield accrues automatically.
          </p>

          <p className="mt-3 text-xs text-text-secondary">
            {rateStatus === "loading" && "Checking Aave for live rates…"}
            {rateStatus === "live" && (
              <span className="text-sage">Showing live rates from Aave&apos;s API.</span>
            )}
            {rateStatus === "fallback" &&
              "Couldn't confirm live Aave rates for X Layer — showing estimated ranges instead."}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {YIELD_ASSETS.map((asset) => (
              <YieldCard
                key={asset.symbol}
                asset={asset}
                liveApy={getLiveApy(asset.symbol)}
                selected={selected.symbol === asset.symbol}
                onSelect={() => setSelected(asset)}
              />
            ))}
          </div>

          <form onSubmit={handleSupply} className="mt-6 rounded-xl border border-hairline-dark bg-surface p-5">
            <label className="text-[11px] uppercase tracking-wide text-text-secondary">
              Amount to supply
            </label>
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-hairline-dark bg-ink px-4 py-3">
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-lg text-white outline-none placeholder:text-text-secondary"
              />
              <span className="shrink-0 rounded-full border border-hairline-dark bg-ink-raised px-3 py-1.5 text-sm text-white">
                {selected.symbol}
              </span>
            </div>

            {amount && Number(amount) > 0 && (
              <div className="mt-4 animate-fade-in-up rounded-lg bg-ink px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-text-secondary">
                  Projected yearly yield (at {selectedLiveApy !== null ? "" : "~"}
                  {estimatedApy.toFixed(2)}% APY)
                </p>
                <p className="mt-1 font-mono text-lg text-sage">
                  +{projectedYearly.toFixed(2)} {selected.symbol}
                </p>
              </div>
            )}

            <button
              type="submit"
              className="mt-5 w-full rounded-full bg-white py-3 text-sm font-medium text-black transition-all duration-150 hover:scale-[1.01] hover:opacity-85 active:scale-[0.99]"
            >
              Supply {selected.symbol}
            </button>

            {feedback && (
              <p className="mt-3 animate-fade-in-up rounded-lg bg-ink px-3 py-2 text-xs text-text-secondary">
                {feedback}
              </p>
            )}
          </form>

          <div className="mt-6 rounded-xl border border-hairline-dark bg-surface/50 p-5">
            <h2 className="text-sm font-medium text-white">How this works</h2>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              Rather than run a separate yield mechanism, PropChain plugs into Aave&apos;s
              lending market — already live on X Layer — for these deposits. Rates are
              set by Aave&apos;s protocol, not PropChain, and move with supply and borrowing
              demand across the pool.{" "}
              {rateStatus === "live"
                ? "The rates above are pulled live from Aave's own API."
                : "Figures above reflect an estimated range, not a live quote — check Aave's interface for the current rate before supplying real funds."}
            </p>
          </div>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
