"use client";

import { useCallback, useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, fallback, http, type Abi, type Address } from "viem";
import { xLayerTestnet, xLayerMainnet } from "./xLayerChain";
import { getActiveNetwork } from "./networkPreference";
import { discoverWallets, getSelectedProviderSync } from "./walletProviders";

// Talks directly to whatever EIP-1193 provider the browser has injected
// (OKX Wallet, MetaMask, or any other extension a user has installed) via
// viem's custom() transport — no wagmi/RainbowKit wrapper needed.
//
// Resolved once per module load from the network toggle's stored
// preference (see NetworkToggle.tsx / networkPreference.ts). The toggle
// does a full page reload rather than a client-side nav specifically so
// this picks up the new choice cleanly.
const ACTIVE_CHAIN = getActiveNetwork() === "mainnet" ? xLayerMainnet : xLayerTestnet;

// Kicked off immediately at module load (not lazily on first use) so
// that by the time a user actually connects or signs anything, wallet
// discovery has almost certainly already finished — it only takes
// ~200ms. See walletProviders.ts for why this exists: without EIP-6963
// discovery, this app could only ever read the single shared
// window.ethereum slot, which meant a second installed wallet
// (MetaMask, etc.) was invisible to it whenever OKX Wallet claimed that
// slot first.
if (typeof window !== "undefined") {
  void discoverWallets();
}

// Hex chain ID + params used for wallet_addEthereumChain / switchEthereumChain
// so a user landing on the wrong active chain gets prompted to switch
// instead of the app silently reading/writing against the wrong network.
const CHAIN_HEX_ID = `0x${ACTIVE_CHAIN.id.toString(16)}`;
const CHAIN_PARAMS = {
  chainId: CHAIN_HEX_ID,
  chainName: ACTIVE_CHAIN.name,
  rpcUrls: [ACTIVE_CHAIN.rpcUrls.default.http[0]],
  nativeCurrency: ACTIVE_CHAIN.nativeCurrency,
  blockExplorerUrls: ACTIVE_CHAIN.blockExplorers
    ? [ACTIVE_CHAIN.blockExplorers.default.url]
    : undefined,
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
};

function getProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  // Prefer the user's explicitly chosen wallet, once discovery has
  // resolved (see walletProviders.ts) — falls through to the legacy
  // window.ethereum slot before discovery finishes, or if the user
  // hasn't made a choice (the common single-wallet case, where there's
  // nothing to choose between anyway).
  const chosen = getSelectedProviderSync();
  if (chosen) return chosen as EthereumProvider;
  const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  return eth ?? null;
}

/**
 * A public client for read-only calls, backed by whatever provider is
 * injected. Returns null if no wallet extension is present — callers
 * should guard with useWallet()'s `connected` state.
 */
// Cached at module scope rather than created fresh per call. This
// matters beyond just avoiding redundant object creation: several hooks
// (useWalletTransactions, useTokenTransferHistory) call getPublicClient()
// directly in their render body and put the result in a useEffect
// dependency array. createPublicClient() returns a new object identity
// every time it's called, so an uncached version of this function meant
// those effects re-ran on every single render — and since the early-
// return branch of those effects unconditionally calls setState, that
// was a real infinite render loop ("Maximum update depth exceeded"), not
// a hypothetical one. Caching means the same object reference is
// returned across renders once a provider is found, so effects that
// depend on it only re-run when they actually should.
//
// Only the "found a provider" result is cached — a null result (no
// wallet extension yet) is never cached, so a wallet that gets installed
// or injected after this module first loaded is still picked up on the
// next call, without needing a page reload.
let cachedPublicClient: ReturnType<typeof createPublicClient> | null = null;

export function getPublicClient() {
  if (cachedPublicClient) return cachedPublicClient;
  const provider = getProvider();
  if (!provider) return null;
  // Reads and receipt polling go straight to X Layer's own RPC, NOT
  // through the wallet extension. Routing them through custom(provider)
  // made confirmation depend on the wallet's (load-balanced, flaky) RPC,
  // so transactions that succeeded on-chain still timed out in the UI.
  // Writes still go through the wallet via getWalletClient().
  const rpcUrl =
    (ACTIVE_CHAIN.id === xLayerTestnet.id
      ? process.env.NEXT_PUBLIC_XLAYER_RPC_URL
      : undefined) || ACTIVE_CHAIN.rpcUrls.default.http[0];
  const rpcUrls = Array.from(
    new Set([
      rpcUrl,
      ...(ACTIVE_CHAIN.id === xLayerTestnet.id ? [] : []),
    ])
  );
  cachedPublicClient = createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: fallback(rpcUrls.map((u) => http(u, { retryCount: 1, timeout: 15_000 }))),
  });
  return cachedPublicClient;
}

/**
 * A wallet client for signing/sending transactions, bound to the given
 * account.
 */
export function getWalletClient(account: Address) {
  const provider = getProvider();
  if (!provider) return null;
  return createWalletClient({
    account,
    chain: ACTIVE_CHAIN,
    transport: custom(provider),
  });
}

export interface WalletState {
  address: Address | null;
  connected: boolean;
  connecting: boolean;
  chainId: number | null;
  wrongChain: boolean;
  error: string | null;
}

/**
 * Requests accounts once on mount (triggers the wallet extension's own
 * connection prompt), tracks the active chain, and exposes
 * switchToActiveChain() for the "wrong network" case.
 */
export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    connected: false,
    connecting: true,
    chainId: null,
    wrongChain: false,
    error: null,
  });

  const refreshChainId = useCallback(async (provider: EthereumProvider) => {
    try {
      const hex = (await provider.request({ method: "eth_chainId" })) as string;
      const chainId = parseInt(hex, 16);
      setState((s) => ({ ...s, chainId, wrongChain: chainId !== ACTIVE_CHAIN.id }));
    } catch {
      // Non-fatal — chain badge just won't update until the next event.
    }
  }, []);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) {
      setState((s) => ({
        ...s,
        connecting: false,
        error: "No wallet extension found. Install OKX Wallet or MetaMask.",
      }));
      return;
    }

    let cancelled = false;

    async function connect() {
      try {
        const accounts = (await provider!.request({ method: "eth_requestAccounts" })) as string[];
        if (cancelled) return;
        setState((s) => ({
          ...s,
          address: (accounts[0] as Address) ?? null,
          connected: accounts.length > 0,
          connecting: false,
        }));
        await refreshChainId(provider!);
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          connecting: false,
          error: err instanceof Error ? err.message : "Wallet connection was rejected.",
        }));
      }
    }

    connect();

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setState((s) => ({
        ...s,
        address: (accounts[0] as Address) ?? null,
        connected: accounts.length > 0,
      }));
    };
    const handleChainChanged = () => {
      refreshChainId(provider!);
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      cancelled = true;
      provider.removeListener("accountsChanged", handleAccountsChanged);
      provider.removeListener("chainChanged", handleChainChanged);
    };
  }, [refreshChainId]);

  const switchToActiveChain = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_HEX_ID }],
      });
    } catch (err) {
      // Error code 4902 means the chain isn't configured in the wallet
      // yet — add it, then the switch happens as part of that call.
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [CHAIN_PARAMS],
        });
      }
    }
  }, []);

  return { ...state, switchToActiveChain };
}

/**
 * Tracks a single in-flight contract write end-to-end (send → confirm),
 * the pattern several pages (listing detail, list, admin/mint) each need
 * for offer/buy/lock/confirm/revoke actions.
 */
export function useTrackedWrite() {
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reset = useCallback(() => {
    setHash(null);
    setIsPending(false);
    setIsConfirming(false);
    setIsSuccess(false);
    setError(null);
  }, []);

  const write = useCallback(
    async (params: {
      account: Address;
      address: Address;
      abi: Abi;
      functionName: string;
      args?: readonly unknown[];
      value?: bigint;
    }) => {
      setError(null);
      setIsSuccess(false);
      setIsPending(true);
      try {
        const walletClient = getWalletClient(params.account);
        const publicClient = getPublicClient();
        if (!walletClient || !publicClient) throw new Error("No wallet provider found.");

        const txHash = await walletClient.writeContract({
          address: params.address,
          abi: params.abi,
          functionName: params.functionName,
          args: params.args,
          value: params.value,
        } as Parameters<typeof walletClient.writeContract>[0]);
        setHash(txHash);
        setIsPending(false);
        setIsConfirming(true);
        // Default viem timeout is ~3 minutes, polling only against our
        // own RPC (xLayerChain.ts). If the wallet actually broadcast
        // through a different RPC endpoint than the one we poll (X
        // Layer testnet's wallet UI can offer more than one), a real,
        // eventually-successful transaction can still time out here —
        // this is an infra mismatch, not application logic, so widening
        // the window is a safety margin, not a real fix for that case.
        await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 300_000 });
        setIsConfirming(false);
        setIsSuccess(true);
      } catch (err) {
        setIsPending(false);
        setIsConfirming(false);
        setError(err);
      }
    },
    []
  );

  return { write, hash, isPending, isConfirming, isSuccess, error, reset };
}
