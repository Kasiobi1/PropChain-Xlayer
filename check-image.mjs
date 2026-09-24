// Standalone diagnostic — reads a token's tokenURI directly from the
// deployed AssetNFT contract, decodes its metadata, and shows exactly
// what image URL(s) are stored on-chain plus what they normalize to.
//
// This bypasses the browser/wallet entirely, same pattern as
// check-tokens.js — useful because it tells you definitively which
// category a "blank image" report falls into:
//   1. No imageUrl/imageUrls in metadata at all -> token predates image
//      support, or the upload silently failed at mint time. Not a bug,
//      just an old/photo-less listing.
//   2. Raw imageUrl was an ipfs://... URI -> confirms the bug this
//      session's fix (normalizeImageUrl in src/lib/assetMetadata.ts)
//      targets. The "Normalizes to" line below will show what it now
//      resolves to in the app.
//   3. imageUrl/imageUrls look like a normal https gateway URL already ->
//      the bug is downstream (dead gateway, expired pin, rate limiting) —
//      the script fetches it with a HEAD request to check reachability.
//
// IMPORTANT CAVEAT (found via real testing, not hypothetical): a clean
// 200 here does NOT guarantee the image displays in the app. This script's
// fetch is server-to-server with no browser referrer — some gateways
// (confirmed on ipfs.ninja's, which lists "origin restrictions" as a
// feature) serve a URL fine here but block the identical URL when it's
// embedded as an <img> on a real page. If this script says 200 but the
// browser still shows nothing, that's the likely cause — see
// src/app/api/image-proxy/route.ts, which routes browser image requests
// through the server for exactly this reason.
//
// Usage: node check-image.mjs <tokenId>
// Example: node check-image.mjs 14   (the "Lambo Urus" token mentioned in
// the handoff — this was mid-diagnostic when the session that wrote it
// got interrupted, so this is a fresh run of the same idea.)

import { createPublicClient, http } from "viem";
import { xLayerTestnet } from "viem/chains";

const ASSET_NFT_ADDRESS = "0xc12ED9316A66a8e405072621EEc6A7a7CE014cfC";
const RPC_URL = "https://testrpc.xlayer.tech/terigon";

const ABI = [
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
];

function decodeMetadataDataUri(uri) {
  if (!uri.startsWith("data:application/json;base64,")) return null;
  try {
    const base64 = uri.replace("data:application/json;base64,", "");
    const json = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Mirrors src/lib/assetMetadata.ts's normalizeImageUrl — kept as a plain
// inline copy here since this script runs standalone via `node`, outside
// the Next.js/TypeScript build.
function normalizeImageUrl(url) {
  const trimmed = url.trim();
  if (/^ipfs:\/\//i.test(trimmed)) {
    const path = trimmed.replace(/^ipfs:\/\/(ipfs\/)?/i, "");
    return `https://ipfs.ninja/ipfs/${path}`;
  }
  return trimmed;
}

// Same order as src/components/AssetThumbnail.tsx — ipfs.ninja's own
// gateway first (dedicated to this project's account, not subject to
// public-gateway rate limiting), public gateways as fallbacks.
const IPFS_GATEWAY_HOSTS = ["ipfs.ninja", "ipfs.io", "ipfs.4everland.io", "dweb.link"];

function getGatewayVariants(url) {
  const match = url.match(/^https:\/\/[^/]+\/ipfs\/(.+)$/);
  if (!match) return [url];
  const path = match[1];
  return IPFS_GATEWAY_HOSTS.map((host) => `https://${host}/ipfs/${path}`);
}

async function checkUrlReachable(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return `${res.status} ${res.statusText}`;
  } catch (err) {
    return `unreachable (${err instanceof Error ? err.message : String(err)})`;
  }
}

async function main() {
  const tokenId = process.argv[2];
  if (!tokenId) {
    console.error("Usage: node check-image.mjs <tokenId>");
    process.exit(1);
  }

  const client = createPublicClient({ chain: xLayerTestnet, transport: http(RPC_URL) });

  console.log(`Reading tokenURI for token #${tokenId}...`);
  const uri = await client.readContract({
    address: ASSET_NFT_ADDRESS,
    abi: ABI,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
  });

  console.log(`\nRaw tokenURI (first 120 chars): ${uri.slice(0, 120)}...`);

  const metadata = decodeMetadataDataUri(uri);
  if (!metadata) {
    console.log(
      "\n-> Not a data:application/json;base64 URI — this token predates real metadata " +
        "support (old placeholder tokenURI). Missing image is expected, not a bug."
    );
    return;
  }

  console.log(`\nDecoded metadata name: ${metadata.name}`);
  console.log(`imageUrl (legacy singular field): ${metadata.imageUrl ?? "(none)"}`);
  console.log(`imageUrls (array field): ${JSON.stringify(metadata.imageUrls ?? null)}`);

  const rawUrls = metadata.imageUrls?.length ? metadata.imageUrls : metadata.imageUrl ? [metadata.imageUrl] : [];

  if (rawUrls.length === 0) {
    console.log("\n-> No image URLs in this token's metadata at all. Either the upload failed " +
      "silently at mint time (check server logs from that mint), or no photos were attached.");
    return;
  }

  for (const [i, raw] of rawUrls.entries()) {
    const normalized = normalizeImageUrl(raw);
    console.log(`\nPhoto ${i + 1}:`);
    console.log(`  Raw:         ${raw}`);
    console.log(`  Normalizes to: ${normalized}`);
    if (raw !== normalized) {
      console.log(`  -> This IS the ipfs:// bug — raw value was not browser-fetchable as stored.`);
    }
    for (const variant of getGatewayVariants(normalized)) {
      console.log(`  ${variant}: ${await checkUrlReachable(variant)}`);
    }
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
