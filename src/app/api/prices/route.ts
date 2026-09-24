import { NextResponse } from "next/server";

// Replaces the previous hardcoded/manually-dated price snapshot in
// coins.ts with a real live fetch from CoinGecko's keyless public API
// (no key needed). Used by the Swap page for conversion rates.
//
// "BASE" (Base-network ETH) isn't its own token — it's ETH itself,
// bridged, so it shares ETH's USD price. USDT/USDC are treated as
// stablecoins pegged to $1 rather than fetched, since CoinGecko's
// stablecoin prices wobble by fractions of a cent in ways that would just
// add noise here, not accuracy, for this use case.
//
// NOT a production-grade price feed: single source, no caching/rate-limit
// handling beyond what CoinGecko's free tier allows, and no fallback if
// CoinGecko is down. Good enough for a swap UI estimate, not for anything
// where getting the price wrong has real financial consequences.

const COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum",
  ARB: "arbitrum",
};

export async function GET() {
  try {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 60 } } // cache for 60s so rapid page interactions don't hammer the API
    );

    if (!res.ok) {
      throw new Error(`CoinGecko API error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();

    const prices: Record<string, number> = {
      ETH: data.ethereum?.usd,
      ARB: data.arbitrum?.usd,
      BASE: data.ethereum?.usd, // Base ETH = ETH's price
      USDT: 1,
      USDC: 1,
    };

    if (typeof prices.ETH !== "number" || typeof prices.ARB !== "number") {
      throw new Error(`CoinGecko returned an unexpected response: ${JSON.stringify(data)}`);
    }

    return NextResponse.json({ prices, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Price fetch failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
