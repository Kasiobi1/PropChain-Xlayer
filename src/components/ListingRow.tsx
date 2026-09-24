import Link from "next/link";
import { VerificationSeal } from "./VerificationSeal";
import { PriceTag } from "./PriceTag";
import type { Listing } from "@/lib/mockListings";

interface ListingRowProps {
  listing: Listing;
  index: number;
  hrefPrefix?: string;
  // See ListingCard's identical prop — how many identical units are still
  // Active when this row represents a multi-unit batch.
  availableCount?: number;
}

export function ListingRow({ listing, index, hrefPrefix = "", availableCount }: ListingRowProps) {
  return (
    <Link
      href={`/listing/${hrefPrefix}${listing.tokenId}`}
      className="group flex items-center gap-5 border-b border-hairline-dark px-4 py-5 transition-colors duration-200 hover:bg-surface sm:px-6"
    >
      <span className="hidden w-8 shrink-0 font-mono text-xs text-text-secondary sm:block">
        {String(index + 1).padStart(2, "0")}
      </span>

      <VerificationSeal size="sm" variant={listing.verifiedOrg ? "org" : "standard"} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="rounded-sm bg-white/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/70">
            {listing.assetType}
          </span>
          <span className="font-mono text-[11px] text-text-secondary">Token #{listing.tokenId}</span>
          {availableCount && availableCount > 1 && (
            <span className="rounded-sm bg-sage/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-sage">
              {availableCount} available
            </span>
          )}
        </div>
        <h3 className="mt-1 truncate font-display text-lg text-white">{listing.name}</h3>
        <p className="mt-0.5 truncate text-sm text-text-secondary">{listing.location}</p>
      </div>

      <div className="hidden flex-col items-end gap-0.5 text-right sm:flex">
        <span className="text-xs text-text-secondary">
          {listing.offerCount > 0
            ? `${listing.offerCount} offer${listing.offerCount === 1 ? "" : "s"}`
            : "No offers yet"}
        </span>
        <span className="font-mono text-[11px] text-text-secondary">{listing.docHashShort}</span>
      </div>

      <PriceTag listing={listing} />
    </Link>
  );
}
