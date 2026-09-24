import type { Listing } from "@/lib/mockListings";

interface PriceTagProps {
  listing: Listing;
}

export function PriceTag({ listing }: PriceTagProps) {
  const { currentPriceEth, floorPriceEth, priceDirection } = listing;
  const changed = priceDirection !== "unchanged";
  const pct = changed
    ? Math.abs(((currentPriceEth - floorPriceEth) / floorPriceEth) * 100)
    : 0;

  const directionColor =
    priceDirection === "up" ? "text-sage" : priceDirection === "down" ? "text-clay" : "text-text-secondary";

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="font-mono text-[15px] font-medium text-white">
        {currentPriceEth.toLocaleString(undefined, { maximumFractionDigits: 3 })} ETH
      </div>
      {changed ? (
        <div className={`flex items-center gap-1 text-[11px] font-mono ${directionColor}`}>
          <span aria-hidden="true">{priceDirection === "up" ? "▲" : "▼"}</span>
          <span>{pct.toFixed(1)}% from floor</span>
        </div>
      ) : (
        <div className="text-[11px] font-mono text-text-secondary">at floor price</div>
      )}
    </div>
  );
}
