"use client";

// Multi Injected Provider Discovery (EIP-6963). Without this, a page can
// only ever read the single shared `window.ethereum` slot — and when
// more than one wallet extension is installed, whichever one is most
// aggressive about claiming that slot (OKX Wallet is a common offender)
// wins it silently, with no way for the page (or the user) to pick a
// different one. EIP-6963 fixes that: every wallet extension announces
// itself separately with its own provider object, so this can list all
// of them and let the user choose.

export interface DiscoveredWallet {
  rdns: string; // reverse-DNS id, e.g. "com.okex.wallet" — stable across sessions, unlike uuid
  name: string;
  icon: string;
  provider: unknown; // EIP-1193 provider, passed straight to viem's custom() transport
}

const STORAGE_KEY = "propchain-wallet-rdns";

let discovered: Map<string, DiscoveredWallet> | null = null;
let discoveryPromise: Promise<Map<string, DiscoveredWallet>> | null = null;

/**
 * Resolves once wallet extensions have had a moment to announce
 * themselves (they respond to a browser event, not a direct call, so
 * there's no way to know synchronously how many are installed). A short
 * fixed wait rather than a signal-based approach, since extensions don't
 * signal "I'm done announcing" — this is the same pattern most EIP-6963
 * reference implementations use.
 */
export function discoverWallets(): Promise<Map<string, DiscoveredWallet>> {
  if (discovered) return Promise.resolve(discovered);
  if (discoveryPromise) return discoveryPromise;
  if (typeof window === "undefined") return Promise.resolve(new Map());

  discoveryPromise = new Promise((resolve) => {
    const found = new Map<string, DiscoveredWallet>();

    function handleAnnounce(event: Event) {
      const { detail } = event as CustomEvent<{
        info: { rdns: string; name: string; icon: string };
        provider: unknown;
      }>;
      if (!detail?.info?.rdns) return;
      found.set(detail.info.rdns, {
        rdns: detail.info.rdns,
        name: detail.info.name,
        icon: detail.info.icon,
        provider: detail.provider,
      });
    }

    window.addEventListener("eip6963:announceProvider", handleAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", handleAnnounce);
      discovered = found;
      resolve(found);
    }, 200);
  });

  return discoveryPromise;
}

export function getStoredWalletChoice(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredWalletChoice(rdns: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, rdns);
}

export function clearStoredWalletChoice() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Synchronous lookup of the user's chosen wallet, once discovery has
 * resolved. Returns null before discovery finishes or if no choice has
 * been made yet — callers should fall back to the legacy
 * window.ethereum in that case, which is exactly what walletConnect.ts's
 * getProvider() does.
 */
export function getSelectedProviderSync(): unknown | null {
  if (!discovered) return null;
  const rdns = getStoredWalletChoice();
  if (!rdns) return null;
  return discovered.get(rdns)?.provider ?? null;
}
