export type CoinSymbol = "ETH" | "ARB" | "BASE" | "USDT" | "USDC";

export interface Coin {
  symbol: CoinSymbol;
  name: string;
  color: string; // used for the token badge
}

// Per product decision: users can only buy assets with ETH — swap exists to
// convert other held coins into ETH on whichever network the user wants to
// buy with. USDT/USDC are included specifically because they're the assets
// supported for the Earn/APY page, not because they're spendable directly.
export const SWAP_COINS: Coin[] = [
  { symbol: "ETH", name: "Ethereum", color: "#8a8a8a" },
  { symbol: "ARB", name: "Arbitrum", color: "#28a0f0" },
  { symbol: "BASE", name: "Base ETH", color: "#0052ff" },
  { symbol: "USDT", name: "Tether", color: "#26a17b" },
  { symbol: "USDC", name: "USD Coin", color: "#2775ca" },
];

export type NetworkId = "ethereum" | "base" | "arbitrum";

export interface Network {
  id: NetworkId;
  label: string;
}

export const DESTINATION_NETWORKS: Network[] = [
  { id: "ethereum", label: "Ethereum Mainnet" },
  { id: "base", label: "Base" },
  { id: "arbitrum", label: "Arbitrum" },
];

// Snapshot USD prices, manually updated Aug 12, 2026 — NOT a live feed.
// Cross-checked against CoinGecko, Coinbase, TradingView, and Yahoo Finance
// (ETH ~$1,900; ARB ~$0.078; sources agreed closely for ARB, ETH sources
// ranged ~$1,880–$1,920, so the converged midpoint was used). These will
// drift further from reality every day they aren't refreshed — before real
// money moves through Swap, this needs a live price oracle (e.g. Chainlink,
// already available on X Layer) instead of a hardcoded snapshot.
export const MOCK_USD_PRICE: Record<CoinSymbol, number> = {
  ETH: 1900,
  ARB: 0.078,
  BASE: 1900, // "Base ETH" is ETH itself, bridged — same USD value
  USDT: 1,
  USDC: 1,
};

export function getSwapRate(from: CoinSymbol, to: CoinSymbol): number {
  return MOCK_USD_PRICE[from] / MOCK_USD_PRICE[to];
}

export interface YieldAsset {
  symbol: "USDT" | "USDC" | "ETH" | "ARB";
  name: string;
  apyRangeLow: number;
  apyRangeHigh: number;
}

// Figures reflect the general neighborhood of supply APY on Aave (the lending
// protocol live on X Layer as of March 2026), not a live feed — Aave rates
// float continuously with pool utilization. See spec section on Earn
// integration: this page is designed to route into Aave on X Layer rather
// than run PropChain's own yield mechanism.
export const YIELD_ASSETS: YieldAsset[] = [
  { symbol: "USDC", name: "USD Coin", apyRangeLow: 3.1, apyRangeHigh: 4.6 },
  { symbol: "USDT", name: "Tether", apyRangeLow: 2.7, apyRangeHigh: 4.1 },
  { symbol: "ETH", name: "Ethereum", apyRangeLow: 1.5, apyRangeHigh: 3.6 },
  { symbol: "ARB", name: "Arbitrum", apyRangeLow: 0.8, apyRangeHigh: 2.9 },
];
