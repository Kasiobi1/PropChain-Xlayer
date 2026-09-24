"use client";

import { useEffect, useState } from "react";
import { getActiveNetwork, setActiveNetwork, type XLayerNetwork } from "@/lib/networkPreference";

/**
 * A small pill button that flips the stored X Layer network preference
 * and reloads the page. It's a full reload rather than client-side state
 * on purpose: contracts.ts and walletConnect.ts both resolve their
 * active chain/addresses once at module load, so a reload is what makes
 * every hook on the page consistently pick up the new network — no
 * half-updated UI where some reads are testnet and others are mainnet.
 *
 * Starts rendering as "Testnet" (the server-safe default) and corrects
 * itself after mount once it can read localStorage, to avoid a
 * hydration mismatch.
 */
export function NetworkToggle() {
  const [network, setNetwork] = useState<XLayerNetwork>("testnet");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setNetwork(getActiveNetwork());
    setMounted(true);
  }, []);

  function handleClick() {
    const next: XLayerNetwork = network === "testnet" ? "mainnet" : "testnet";
    setActiveNetwork(next);
    window.location.reload();
  }

  const isMainnet = network === "mainnet";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!mounted}
      title={
        isMainnet
          ? "X Layer mainnet — contracts aren't deployed there yet, so reads will come back empty."
          : "X Layer testnet — the live, working deployment."
      }
      className="flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-white transition-colors hover:border-white/50 disabled:opacity-0"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isMainnet ? "bg-emerald-400" : "bg-seal-gold-soft"}`}
        aria-hidden
      />
      {isMainnet ? "Mainnet" : "Testnet"}
    </button>
  );
}
