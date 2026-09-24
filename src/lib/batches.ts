import type { Listing } from "./mockListings";

export interface ListingBatch {
  // Shown as the card/representative — lowest tokenId among the batch's
  // Active siblings, for a stable, deterministic pick.
  representative: Listing;
  // Every Active token ID sharing this batchId, sorted ascending. Length 1
  // for a listing that was never part of a multi-unit batch.
  activeTokenIds: number[];
}

/**
 * Groups real listings that share a batchId (see assetMetadata.ts's batchId
 * field and /list's handleMint) into one entry per batch, so N identical
 * units display as one card instead of N visually-duplicate ones. Listings
 * without a batchId pass through as their own batch of one — this function
 * is safe to run over a mixed list of batched and non-batched listings, and
 * over mock listings (which never have a batchId).
 *
 * Expects `listings` to already be Active-only, which is what
 * useRealListings returns — it filters out Sold/Cancelled before this ever
 * sees them, so every activeTokenIds entry here is genuinely purchasable.
 */
export function groupListingsIntoBatches(listings: Listing[]): ListingBatch[] {
  const byBatch = new Map<string, Listing[]>();
  const standalone: Listing[] = [];

  for (const listing of listings) {
    if (listing.batchId) {
      const group = byBatch.get(listing.batchId) ?? [];
      group.push(listing);
      byBatch.set(listing.batchId, group);
    } else {
      standalone.push(listing);
    }
  }

  const batches: ListingBatch[] = standalone.map((listing) => ({
    representative: listing,
    activeTokenIds: [listing.tokenId],
  }));

  for (const group of byBatch.values()) {
    const sorted = [...group].sort((a, b) => a.tokenId - b.tokenId);
    batches.push({ representative: sorted[0], activeTokenIds: sorted.map((l) => l.tokenId) });
  }

  return batches;
}

/**
 * Every Active sibling token ID for a given listing (same batchId, sorted
 * ascending) — used by the listing detail page's quantity-buy flow to know
 * which token IDs it can actually purchase. Returns just the listing's own
 * tokenId if it was never part of a batch.
 */
export function getBatchSiblingTokenIds(listings: Listing[], listing: Listing): number[] {
  if (!listing.batchId) return [listing.tokenId];
  return listings
    .filter((l) => l.batchId === listing.batchId)
    .map((l) => l.tokenId)
    .sort((a, b) => a - b);
}
