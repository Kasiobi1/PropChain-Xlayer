import Link from "next/link";
import { AssetThumbnail } from "./AssetThumbnail";
import { VerificationSeal } from "./VerificationSeal";
import { PriceTag } from "./PriceTag";
import type { Listing } from "@/lib/mockListings";

interface ListingCardProps {
  listing: Listing;
  index: number;
  hrefPrefix?: string; // "real-" for on-chain listings, "" for mock — see useRealListings.ts
  // Present when this card represents a multi-unit batch (see
  // src/lib/batches.ts) — how many identical units are still Active.
  // Omitted (or 1) shows no badge, same as before this feature existed.
  availableCount?: number;
}

// Small deterministic initial for the seller avatar — no real profile images yet,
// this stands in until off-chain seller profiles exist.
function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ListingCard({ listing, index, hrefPrefix = "", availableCount }: ListingCardProps) {
  return (
    <Link href={`/listing/${hrefPrefix}${listing.tokenId}`} className="group [perspective:1200px] block">
      <div className="rounded-xl border border-hairline-dark bg-surface shadow-sm transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:border-white/20 group-hover:bg-surface-hover group-hover:shadow-xl">
        {/* Seller row */}
        <div className="flex items-center gap-2.5 px-4 pt-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-medium text-black">
            {initials(listing.sellerName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">{listing.sellerName}</p>
            <p className="truncate text-[11px] text-text-secondary">{listing.location}</p>
          </div>
        </div>

        {/* Asset image */}
        <div className="relative mt-3 px-3">
          <div className="overflow-hidden rounded-lg border border-hairline-dark">
            <AssetThumbnail assetType={listing.assetType} seed={index} imageUrl={listing.imageUrls?.[0] ?? listing.imageUrl} />
          </div>
          <div className="absolute right-5 top-2">
            <VerificationSeal size="sm" variant={listing.verifiedOrg ? "org" : "standard"} />
          </div>
          <span className="absolute left-5 top-2 rounded-sm bg-black/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-white backdrop-blur-sm">
            {listing.assetType}
          </span>
          {availableCount && availableCount > 1 && (
            <span className="absolute left-5 top-9 rounded-sm bg-sage/90 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-white backdrop-blur-sm">
              {availableCount} available
            </span>
          )}
        </div>

        <div className="p-4">
          <h3 className="line-clamp-2 font-display text-base leading-snug text-white">
            {listing.name}
          </h3>

          <div className="mt-3 flex items-end justify-between border-t border-hairline-dark pt-3">
            <span className="text-[11px] text-text-secondary">
              {listing.offerCount > 0
                ? `${listing.offerCount} offer${listing.offerCount === 1 ? "" : "s"}`
                : "No offers"}
            </span>
            <PriceTag listing={listing} />
          </div>
        </div>
      </div>
    </Link>
  );
}
