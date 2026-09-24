"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/walletConnect";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { NetworkToggle } from "@/components/NetworkToggle";
import {
  SWAP_COINS,
  DESTINATION_NETWORKS,
  MOCK_USD_PRICE,
  type CoinSymbol,
  type NetworkId,
} from "@/lib/coins";

export default function SwapPage() {
  const { connected: isConnected, address } = useWallet();
  const [fromCoin, setFromCoin] = useState<CoinSymbol>("USDC");
  const [toCoin, setToCoin] = useState<CoinSymbol>("ETH");
  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState<NetworkId>("ethereum");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [flipCount, setFlipCount] = useState(0);

  // Live prices, fetched from /api/prices (CoinGecko under the hood) on
  // load. Falls back to the hardcoded MOCK_USD_PRICE snapshot in coins.ts
  // if the fetch fails, so the page still works (with a visible warning)
  // rather than breaking entirely.
  const [prices, setPrices] = useState<Record<CoinSymbol, number>>(MOCK_USD_PRICE);
  const [priceStatus, setPriceStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [priceFetchedAt, setPriceFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prices")
      .then((res) => {
        if (!res.ok) throw new Error("Price fetch failed");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPrices(data.prices);
        setPriceFetchedAt(data.fetchedAt);
        setPriceStatus("live");
      })
      .catch(() => {
        if (cancelled) return;
        setPriceStatus("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function getSwapRate(from: CoinSymbol, to: CoinSymbol): number {
    return prices[from] / prices[to];
  }

  const estimate = useMemo(() => {
    const parsed = Number(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) return null;
    return parsed * getSwapRate(fromCoin, toCoin);
  }, [amount, fromCoin, toCoin, prices]);

  const networkLabel = DESTINATION_NETWORKS.find((n) => n.id === network)?.label ?? "";

  function flipCoins() {
    setFromCoin(toCoin);
    setToCoin(fromCoin);
    setFlipCount((n) => n + 1);
  }

  function handleFromChange(next: CoinSymbol) {
    if (next === toCoin) {
      // avoid same-coin swap by bumping the other side to the previous "from"
      setToCoin(fromCoin);
    }
    setFromCoin(next);
  }

  function handleToChange(next: CoinSymbol) {
    if (next === fromCoin) {
      setFromCoin(toCoin);
    }
    setToCoin(next);
  }

  function handleSwap(e: React.FormEvent) {
    e.preventDefault();
    if (!estimate) {
      setFeedback("Enter an amount to swap first.");
      return;
    }
    const destination = toCoin === "ETH" ? ` on ${networkLabel}` : "";
    if (!isConnected) {
      setFeedback("Connect a wallet to complete this swap.");
      return;
    }
    setFeedback(
      `Wallet connected (${address?.slice(0, 6)}…${address?.slice(-4)}) — ${amount} ${fromCoin} → ~${estimate.toFixed(5)} ${toCoin}${destination} isn't wired to a live contract yet.`
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

        <main className="mx-auto max-w-lg px-4 py-12 sm:px-8">
          <h1 className="animate-fade-in-up font-display text-3xl text-white">Swap</h1>
          <p className="mt-2 animate-fade-in-up text-sm text-text-secondary" style={{ animationDelay: "60ms" }}>
            Swap between any supported coin. Buying assets on PropChain always settles in ETH,
            so swap into ETH on your chosen network before checking out — or swap into USDT/USDC
            to supply on the Earn page.
          </p>

          <form onSubmit={handleSwap} className="mt-8 rounded-xl border border-hairline-dark bg-surface p-5">
            <label className="text-[11px] uppercase tracking-wide text-text-secondary">You pay</label>
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-hairline-dark bg-ink px-4 py-3 transition-colors focus-within:border-white/40">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-transparent text-lg text-white outline-none placeholder:text-text-secondary"
              />
              <select
                value={fromCoin}
                onChange={(e) => handleFromChange(e.target.value as CoinSymbol)}
                className="shrink-0 rounded-full border border-hairline-dark bg-ink-raised px-3 py-1.5 text-sm text-white outline-none"
              >
                {SWAP_COINS.map((coin) => (
                  <option key={coin.symbol} value={coin.symbol}>
                    {coin.symbol}
                  </option>
                ))}
              </select>
            </div>

            <div className="my-3 flex items-center justify-center">
              <button
                type="button"
                onClick={flipCoins}
                aria-label="Flip swap direction"
                style={{ transform: `rotate(${flipCount * 180}deg)` }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline-dark bg-ink-raised transition-all duration-300 hover:border-white/40 hover:scale-110"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 10l-3 3 3 3M4 13h16M17 4l3 3-3 3M20 7H4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <label className="text-[11px] uppercase tracking-wide text-text-secondary">You receive (estimated)</label>
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-hairline-dark bg-ink px-4 py-3 transition-colors focus-within:border-white/40">
              <span key={estimate ?? 0} className="w-full animate-fade-in-up text-lg text-white">
                {estimate ? estimate.toFixed(5) : "0.0"}
              </span>
              <select
                value={toCoin}
                onChange={(e) => handleToChange(e.target.value as CoinSymbol)}
                className="shrink-0 rounded-full border border-hairline-dark bg-ink-raised px-3 py-1.5 text-sm text-white outline-none"
              >
                {SWAP_COINS.map((coin) => (
                  <option key={coin.symbol} value={coin.symbol}>
                    {coin.symbol}
                  </option>
                ))}
              </select>
            </div>

            {amount && Number(amount) > 0 && (
              <p className="mt-2 animate-fade-in-up text-[11px] text-text-secondary">
                1 {fromCoin} ≈ {getSwapRate(fromCoin, toCoin).toFixed(5)} {toCoin}
              </p>
            )}

            {toCoin === "ETH" && (
              <div className="animate-fade-in-up">
                <label className="mt-5 block text-[11px] uppercase tracking-wide text-text-secondary">
                  Destination network
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {DESTINATION_NETWORKS.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setNetwork(n.id)}
                      className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all duration-150 ${
                        network === n.id
                          ? "scale-[1.03] border-white bg-white text-black"
                          : "border-hairline-dark text-text-secondary hover:text-white"
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="mt-6 w-full rounded-full bg-white py-3 text-sm font-medium text-black transition-all duration-150 hover:scale-[1.01] hover:opacity-85 active:scale-[0.99]"
            >
              Swap
            </button>

            {feedback && (
              <p className="mt-3 animate-fade-in-up rounded-lg bg-ink px-3 py-2 text-xs text-text-secondary">
                {feedback}
              </p>
            )}
          </form>

          <p className="mt-4 text-[11px] leading-relaxed text-text-secondary">
            {priceStatus === "loading" && "Fetching live prices…"}
            {priceStatus === "live" &&
              `Live prices from CoinGecko${priceFetchedAt ? `, updated ${new Date(priceFetchedAt).toLocaleTimeString()}` : ""}. Stablecoins (USDT/USDC) are treated as $1. Once wallet integration is live, swaps will use real quotes from on-chain liquidity on X Layer.`}
            {priceStatus === "fallback" &&
              "Couldn't reach the live price feed — showing a fallback snapshot instead, which may be stale. Once wallet integration is live, swaps will use real quotes from on-chain liquidity on X Layer."}
          </p>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
