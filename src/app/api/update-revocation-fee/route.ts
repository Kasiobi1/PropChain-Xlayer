import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { xLayerTestnet } from "@/lib/xLayerChain";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { ESCROW_HOLD_ABI } from "@/lib/escrowHoldAbi";

// Keeps EscrowHold.sol's revocationFeeWei tracking a real USD target,
// per the original spec: "approximately $0.10–$0.20 worth of ETH,
// USD-denominated, converted at time of transaction, not a flat ETH
// amount." Previously this was a flat wei number set once at deploy time
// and never updated — meaning it silently drifted from the intended USD
// value as ETH's price moved. This route:
//   1. Fetches live ETH/USD from CoinGecko's keyless public API (no key
//      needed — https://docs.coingecko.com/docs/keyless-public-api).
//   2. Computes the wei amount for a target USD fee (defaults to the
//      midpoint of the spec's $0.10–$0.20 range: $0.15).
//   3. Calls setRevocationFeeWei() using the owner wallet (same wallet as
//      VERIFIER_PRIVATE_KEY — EscrowHold's Ownable(msg.sender) makes the
//      deployer the owner) if the current on-chain value has drifted
//      meaningfully from the target.
//
// NOT a real oracle: this is a single centralized price source with no
// redundancy, no on-chain verifiability of the price used, and depends on
// this route actually being called periodically (e.g. via a cron job or
// manually) — it does not run itself. A production version would use a
// real oracle (Chainlink or similar) directly in the contract instead of
// a server pushing values in. Flagged as a known limitation, not fixed
// here — matches the hackathon-stage tradeoffs flagged elsewhere in this
// project.

const VERIFIER_PRIVATE_KEY = process.env.VERIFIER_PRIVATE_KEY as `0x${string}` | undefined;
const RPC_URL = process.env.XLAYER_RPC_URL || "https://testrpc.xlayer.tech/terigon";
const TARGET_USD_FEE = 0.15; // midpoint of spec's $0.10–$0.20 range
const DRIFT_THRESHOLD_PERCENT = 10; // only update on-chain if drift exceeds this, to avoid spamming gas for tiny fluctuations

export async function POST() {
  try {
    if (!VERIFIER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "VERIFIER_PRIVATE_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    // X Layer's native gas token is OKB, not ETH — the fee this route
    // sets is denominated in the chain's native token, so the USD
    // conversion has to price OKB, not ETH. Reusing the ETH price here
    // (as the prior Base Sepolia version did) would size the fee wrong
    // by whatever the ETH/OKB price ratio happens to be.
    const priceRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=okb&vs_currencies=usd"
    );
    if (!priceRes.ok) {
      throw new Error(`CoinGecko API error (${priceRes.status}): ${await priceRes.text()}`);
    }
    const priceData = await priceRes.json();
    const okbUsdPrice = priceData?.okb?.usd;
    if (typeof okbUsdPrice !== "number" || okbUsdPrice <= 0) {
      throw new Error(`CoinGecko returned an unexpected response: ${JSON.stringify(priceData)}`);
    }

    const targetOkbAmount = TARGET_USD_FEE / okbUsdPrice;
    const targetWei = parseEther(targetOkbAmount.toFixed(18));

    const account = privateKeyToAccount(VERIFIER_PRIVATE_KEY);
    const transport = http(RPC_URL);
    const publicClient = createPublicClient({ chain: xLayerTestnet, transport });
    const walletClient = createWalletClient({ account, chain: xLayerTestnet, transport });

    const currentFeeWei = (await publicClient.readContract({
      address: CONTRACT_ADDRESSES.escrowHold,
      abi: ESCROW_HOLD_ABI,
      functionName: "revocationFeeWei",
    })) as bigint;

    const currentFeeOkb = Number(formatEther(currentFeeWei));
    const driftPercent =
      currentFeeOkb === 0
        ? 100
        : Math.abs((targetOkbAmount - currentFeeOkb) / currentFeeOkb) * 100;

    if (driftPercent < DRIFT_THRESHOLD_PERCENT) {
      return NextResponse.json({
        updated: false,
        reason: `Drift (${driftPercent.toFixed(1)}%) below ${DRIFT_THRESHOLD_PERCENT}% threshold — no update needed.`,
        okbUsdPrice,
        currentFeeWei: currentFeeWei.toString(),
        currentFeeOkb,
        targetFeeOkb: targetOkbAmount,
      });
    }

    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESSES.escrowHold,
      abi: ESCROW_HOLD_ABI,
      functionName: "setRevocationFeeWei",
      args: [targetWei],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json({
      updated: true,
      transactionHash: hash,
      status: receipt.status,
      okbUsdPrice,
      previousFeeWei: currentFeeWei.toString(),
      previousFeeOkb: currentFeeOkb,
      newFeeWei: targetWei.toString(),
      newFeeOkb: targetOkbAmount,
      driftPercent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Price feed update failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET support too, so this can be checked/triggered from a browser or a
// simple cron ping without needing to construct a POST request.
export async function GET() {
  return POST();
}
