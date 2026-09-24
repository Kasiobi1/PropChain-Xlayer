"use client";

import { ASSET_TYPE_LABELS, type AssetType } from "@/lib/mockListings";

interface FilterBarProps {
  active: AssetType | "All";
  onChange: (value: AssetType | "All") => void;
  counts: Record<string, number>;
}

const TYPES: (AssetType | "All")[] = ["All", "House", "Land", "Phone", "Gadget", "Car"];

export function FilterBar({ active, onChange, counts }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-hairline-dark bg-ink px-4 pb-4 sm:px-6">
      {TYPES.map((type) => {
        const label = type === "All" ? "All Assets" : ASSET_TYPE_LABELS[type];
        const count = counts[type] ?? 0;
        const isActive = active === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`rounded-sm px-3.5 py-2 font-mono text-[12px] uppercase tracking-wide transition-colors duration-150 ${
              isActive
                ? "bg-seal-gold-soft text-ink"
                : "text-parchment/45 hover:text-parchment/80"
            }`}
          >
            {label}
            <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
