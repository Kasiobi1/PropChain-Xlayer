"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/walletConnect";
import {
  discoverWallets,
  getStoredWalletChoice,
  setStoredWalletChoice,
  type DiscoveredWallet,
} from "@/lib/walletProviders";

/**
 * Reflects the injected wallet's connection state (OKX Wallet, MetaMask,
 * or any other EIP-1193 extension) rather than opening a "choose a
 * wallet" modal of its own — requesting accounts triggers the
 * extension's own native confirmation dialog. The one interactive case
 * is "wrong network", where tapping the button requests a chain switch
 * to X Layer testnet through the injected provider.
 *
 * The other interactive case is the small "⇄" picker, shown only when
 * more than one wallet extension is actually installed (see
 * walletProviders.ts) — without it, the app just silently used whichever
 * extension happened to claim window.ethereum (often OKX Wallet, even
 * with MetaMask also installed), with no way to choose otherwise.
 */
export function ConnectWalletButton() {
  const { address, connected, connecting, wrongChain, error, switchToActiveChain } =
    useWallet();
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [activeRdns, setActiveRdns] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    discoverWallets().then((found) => setWallets(Array.from(found.values())));
    setActiveRdns(getStoredWalletChoice());
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pickerOpen]);

  function selectWallet(rdns: string) {
    setStoredWalletChoice(rdns);
    // Full reload, not client state — getPublicClient()/getWalletClient()
    // in walletConnect.ts cache their client once per module load, so a
    // reload is what makes the newly chosen wallet actually take effect
    // everywhere, not just in this button.
    window.location.reload();
  }

  // Only worth showing a picker when there's an actual choice to make —
  // most people have exactly one wallet extension installed.
  const showPicker = wallets.length > 1;

  const pickerButton = showPicker && (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        title="Choose which wallet extension to connect with"
        className="rounded-full border border-white/25 px-2.5 py-2 text-xs text-white/70 transition-colors hover:border-white/50 hover:text-white"
      >
        ⇄
      </button>
      {pickerOpen && (
        <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-white/15 bg-black/95 p-1 shadow-xl">
          {wallets.map((w) => {
            const isActive = activeRdns === w.rdns;
            return (
              <button
                key={w.rdns}
                type="button"
                onClick={() => selectWallet(w.rdns)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-white/10 ${
                  isActive ? "text-white" : "text-white/70"
                }`}
              >
                {w.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.icon} alt="" className="h-4 w-4 rounded-sm" />
                )}
                {w.name}
                {isActive && <span className="ml-auto text-[10px] text-seal-gold-soft">Active</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (connecting) {
    return (
      <div
        aria-hidden
        className="rounded-full border border-white/25 px-4 py-2 text-xs font-medium text-white opacity-0"
      >
        Connect Wallet
      </div>
    );
  }

  if (error || !connected) {
    return (
      <div className="flex items-center gap-2">
        {pickerButton}
        <button
          type="button"
          disabled
          title={error ?? "No wallet extension detected."}
          className="rounded-full border border-white/25 px-4 py-2 text-xs font-medium text-white/50"
        >
          {error ? "Wallet unavailable" : "Not connected"}
        </button>
      </div>
    );
  }

  if (wrongChain) {
    return (
      <div className="flex items-center gap-2">
        {pickerButton}
        <button
          type="button"
          onClick={switchToActiveChain}
          className="rounded-full border border-clay px-4 py-2 text-xs font-medium text-clay transition-colors hover:bg-clay hover:text-white"
        >
          Wrong network
        </button>
      </div>
    );
  }

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  return (
    <div className="flex items-center gap-2">
      {pickerButton}
      <span className="rounded-full border border-white/25 px-4 py-2 text-xs font-medium text-white">
        {short}
      </span>
    </div>
  );
}
