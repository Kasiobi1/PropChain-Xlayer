"use client";

import { useState } from "react";
import { AssetThumbnail } from "./AssetThumbnail";
import type { AssetType } from "@/lib/mockListings";

interface ListingMediaCarouselProps {
  assetType: AssetType;
  tokenId: number;
  imageUrls?: string[]; // real IPFS photos, if the seller uploaded any — shown as a gallery
}

/**
 * Shows the asset's photos in a simple gallery — real uploaded photos if
 * any exist (imageUrls, from Pinata — see api/upload-image/route.ts),
 * otherwise falls back to the illustrated thumbnail. Video was removed —
 * large user-uploaded video carries real size-limit and moderation risk
 * this project isn't set up to handle yet.
 */
export function ListingMediaCarousel({ assetType, tokenId, imageUrls }: ListingMediaCarouselProps) {
  const [index, setIndex] = useState(0);
  const photos = imageUrls && imageUrls.length > 0 ? imageUrls : [undefined];

  return (
    <div className="overflow-hidden rounded-xl border border-hairline-dark">
      <div className="relative">
        <AssetThumbnail assetType={assetType} seed={tokenId * 7 + index} imageUrl={photos[index]} />

        {photos.length > 1 && (
          <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 font-mono text-[11px] text-white backdrop-blur-sm">
            {index + 1}/{photos.length}
          </span>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 border-t border-hairline-dark bg-surface p-2">
          {photos.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              className={`flex h-14 flex-1 items-center justify-center overflow-hidden rounded-md border transition-colors ${
                i === index ? "border-white" : "border-hairline-dark opacity-60 hover:opacity-100"
              }`}
            >
              <div className="h-full w-full scale-150">
                <AssetThumbnail assetType={assetType} seed={tokenId * 7 + i} imageUrl={url} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
