import { NextResponse } from "next/server";

// Attempts to replace the hardcoded APY ranges in coins.ts with real data
// from Aave's official GraphQL API (https://api.v3.aave.com/graphql, no
// key required per Aave's docs). This is genuinely uncertain to work:
// X Layer's Aave deployment (confirmed live as of March 2026 per earlier
// research) may or may not be indexed in Aave's own API yet — this route
// was written without the ability to test it against the live API (this
// dev environment's network is restricted), so it queries defensively:
// list chains first, look for X Layer specifically, and fall back to the
// existing hardcoded ranges in coins.ts (via the caller) if X Layer isn't
// found or the API is unreachable. TEST THIS ON A MACHINE WITH REAL
// NETWORK ACCESS before trusting it — if X Layer isn't in Aave's API yet,
// this will always return the "not found" fallback signal, which is
// expected and handled, not a bug.

const AAVE_GRAPHQL_URL = "https://api.v3.aave.com/graphql";
const XLAYER_CHAIN_ID = 196; // X Layer mainnet — Aave's API almost certainly indexes by mainnet chain ID even though our contracts are on testnet, since Aave itself is deployed on X Layer mainnet, not testnet

const TARGET_SYMBOLS = ["USDC", "USDT", "WETH", "ETH"];

async function aaveQuery(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(AAVE_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Aave GraphQL error (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Aave GraphQL returned errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

export async function GET() {
  try {
    // Step 1: confirm X Layer is actually a chain Aave's API knows about.
    const chainsData = await aaveQuery(`query { chains { name chainId } }`);
    const chains = chainsData?.chains ?? [];
    const xLayerChain = chains.find(
      (c: { chainId: number; name: string }) =>
        c.chainId === XLAYER_CHAIN_ID || /x\s*layer/i.test(c.name)
    );

    if (!xLayerChain) {
      return NextResponse.json({
        found: false,
        reason: "X Layer not found in Aave's indexed chains — falling back to hardcoded ranges.",
        availableChains: chains.map((c: { name: string; chainId: number }) => ({
          name: c.name,
          chainId: c.chainId,
        })),
      });
    }

    // Step 2: fetch markets for that chain, then reserves within it.
    const marketsData = await aaveQuery(
      `query Markets($chainIds: [Int!]!) {
        markets(chainIds: $chainIds) {
          name
          address
          supplyReserves {
            underlyingToken { symbol }
            supplyInfo { apy }
          }
        }
      }`,
      { chainIds: [xLayerChain.chainId] }
    );

    const markets = marketsData?.markets ?? [];
    const rates: Record<string, number> = {};

    for (const market of markets) {
      for (const reserve of market.supplyReserves ?? []) {
        const symbol = reserve.underlyingToken?.symbol;
        const apy = reserve.supplyInfo?.apy;
        if (symbol && TARGET_SYMBOLS.includes(symbol.toUpperCase()) && typeof apy === "number") {
          rates[symbol.toUpperCase()] = apy;
        }
      }
    }

    return NextResponse.json({
      found: true,
      chain: xLayerChain,
      rates,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Aave rate fetch failed.";
    return NextResponse.json({ found: false, error: message }, { status: 200 });
  }
}
