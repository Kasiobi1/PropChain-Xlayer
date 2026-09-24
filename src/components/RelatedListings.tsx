import Link from "next/link";
import { AssetThumbnail } from "./AssetThumbnail";
import { PriceTag } from "./PriceTag";
import type { Listing } from "@/lib/mockListings";

interface RelatedListingsProps {
  listings: Listing[];
  hrefPrefix?: string;
}

export function RelatedListings({ listings, hrefPrefix = "" }: RelatedListingsProps) {
  if (listings.length === 0) return null;

  return (
    <section className="mt-14 border-t border-hairline-dark pt-8">
      <h2 className="font-display text-lg text-white">More like this</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {listings.map((listing) => (
          <Link
            key={listing.tokenId}
            href={`/listing/${hrefPrefix}${listing.tokenId}`}
            className="group block overflow-hidden rounded-lg border border-hairline-dark bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-surface-hover hover:shadow-xl"
          >
            <AssetThumbnail assetType={listing.assetType} seed={listing.tokenId} imageUrl={listing.imageUrls?.[0] ?? listing.imageUrl} />
            <div className="p-3">
              <p className="truncate text-xs font-medium text-white">{listing.name}</p>
              <div className="mt-1.5">
                <PriceTag listing={listing} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
