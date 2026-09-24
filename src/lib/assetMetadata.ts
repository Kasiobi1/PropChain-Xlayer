/**
 * Encodes NFT metadata as a `data:` URI instead of pinning to IPFS. This is
 * a real, standard technique (used by many on-chain NFT projects for
 * lightweight metadata) — no external pinning service or API key needed,
 * and the metadata is fully retrievable by any client that resolves
 * tokenURI(), same as a real IPFS gateway would provide.
 *
 * Real photos DO now have real storage — via Pinata (see
 * /api/upload-image/route.ts) — the image itself gets uploaded there, and
 * only the resulting IPFS URL is embedded here as `imageUrl`, which keeps
 * the on-chain data: URI small and cheap regardless of photo size.
 */

// Single source of truth for the IPFS gateway config, imported by both
// the client display layer (AssetThumbnail) and the server proxy
// (/api/image-proxy). This is the account's *dedicated* Pinata gateway.
// The shared gateway.pinata.cloud 404s on freshly-pinned content, so the
// dedicated domain is the only one that reliably serves this account's
// uploads.
export const PINATA_GATEWAY_HOST = "plum-decisive-horse-820.mypinata.cloud";

// Ordered by likelihood of success: the account's own dedicated gateway
// first (content is pinned there, so it's always a hit and isn't subject
// to public-gateway rate limiting), then public gateways as a fallback
// in case Pinata itself has an outage.
export const IPFS_GATEWAY_HOSTS = [
  PINATA_GATEWAY_HOST,
  "ipfs.io",
  "dweb.link",
  "ipfs.4everland.io",
];

export interface AssetMetadata {
  name: string;
  description: string;
  location: string;
  assetType: string;
  imageUrl?: string; // kept for backward compatibility with tokens minted before multi-image support
  imageUrls?: string[]; // real photos, in display order — preferred over imageUrl going forward
  attributes: { trait_type: string; value: string }[];
  // Shared across every token minted from the same "N identical units"
  // listing action (see /list's handleMint) — groups siblings together for
  // display and lets "supply" become a real, decrementing count of how
  // many of that batch's tokens are still Active, instead of a cosmetic
  // number on one token. Undefined for single-unit listings and any token
  // minted before this existed.
  batchId?: string;
  // True only for assets minted via /admin/mint — the operator's own
  // personal confirmation that this seller is a real organization/agent,
  // on top of (not instead of) the standard AI document verification every
  // listing goes through. Undefined/false for anything minted via /list,
  // and for any token minted before this field existed.
  verifiedOrg?: boolean;
}

export function encodeMetadataDataUri(metadata: AssetMetadata): string {
  const json = JSON.stringify(metadata);
  // base64-encode so the URI is safe to pass as a Solidity string argument
  // without worrying about quote/special-character escaping issues.
  const base64 = typeof window !== "undefined" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, "utf-8").toString("base64");
  return `data:application/json;base64,${base64}`;
}

export function decodeMetadataDataUri(uri: string): AssetMetadata | null {
  if (!uri.startsWith("data:application/json;base64,")) return null;
  try {
    const base64 = uri.replace("data:application/json;base64,", "");
    const json =
      typeof window !== "undefined"
        ? decodeURIComponent(escape(atob(base64)))
        : Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Normalizes an image URL for browser display. Some IPFS pinning
// services hand back an `ipfs://<cid>` URI rather than an https gateway
// link. `ipfs://` is not a scheme browsers know how to fetch —
// an <img src="ipfs://..."> just renders blank, no error surfaced. This
// strips that scheme and rewrites to a public gateway URL. Already-https
// URLs pass through untouched. Applied both at upload time (so new
// mints store a clean URL) and at read time here (so tokens already
// minted with a raw ipfs:// URL baked into their on-chain metadata still
// display correctly, since that metadata itself can't be edited after
// the fact).
// Normalizes an image URL for browser display. Some IPFS pinning
// services hand back an `ipfs://<cid>` URI rather than an https gateway
// link. `ipfs://` is not a scheme browsers know how to fetch — an
// <img src="ipfs://..."> just renders blank, no error surfaced. This
// strips that scheme and rewrites to a public gateway URL. Already-https
// URLs pass through untouched. Applied both at upload time (so new
// mints store a clean URL) and at read time here (so tokens already
// minted with a raw ipfs:// URL baked into their on-chain metadata still
// display correctly, since that metadata itself can't be edited after
// the fact).
export function normalizeImageUrl(url: string): string {
  const trimmed = url.trim();

  if (/^ipfs:\/\//i.test(trimmed)) {
    // Some tools double up as ipfs://ipfs/<cid> — strip either form down
    // to the bare path (cid, optionally with a /filename suffix).
    const path = trimmed.replace(/^ipfs:\/\/(ipfs\/)?/i, "");
    return `https://${PINATA_GATEWAY_HOST}/ipfs/${path}`;
  }

  // ipfs.ninja shut down entirely, so any URL still pointing at its
  // gateway is a guaranteed dead request. Rewriting the host here at
  // read time at least sends the request somewhere that's alive.
  const deadGateway = trimmed.match(/^https:\/\/ipfs\.ninja\/ipfs\/(.+)$/i);
  if (deadGateway) {
    return `https://${PINATA_GATEWAY_HOST}/ipfs/${deadGateway[1]}`;
  }

  return trimmed;
}

// Normalizes old single-image tokens (imageUrl) and new multi-image tokens
// (imageUrls) into one array, so display components only need to handle
// one shape. Returns an empty array if the token has no real photos.
export function getMetadataImageUrls(metadata: AssetMetadata | null): string[] {
  if (!metadata) return [];
  if (metadata.imageUrls && metadata.imageUrls.length > 0) {
    return metadata.imageUrls.map(normalizeImageUrl);
  }
  if (metadata.imageUrl) return [normalizeImageUrl(metadata.imageUrl)];
  return [];
}
