"use client";

import { useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ListingRow } from "@/components/ListingRow";
import { ListingCard } from "@/components/ListingCard";
import { MOCK_LISTINGS, ASSET_TYPE_LABELS, type AssetType } from "@/lib/mockListings";

export default function ComparePage() {
  const [activeType, setActiveType] = useState<AssetType | "All">("All");
  const [view, setView] = useState<"list" | "grid">("grid");

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: MOCK_LISTINGS.length };
    for (const l of MOCK_LISTINGS) {
      c[l.assetType] = (c[l.assetType] ?? 0) + 1;
    }
    return c;
  }, []);

  const filtered = useMemo(() => {
    if (activeType === "All") return MOCK_LISTINGS;
    return MOCK_LISTINGS.filter((l) => l.assetType === activeType);
  }, [activeType]);

  const TYPES: (AssetType | "All")[] = ["All", "House", "Land", "Phone", "Gadget"];

  return (
    <div className="flex min-h-full bg-parchment">
      <Sidebar />

      <div className="flex-1">
        {/* Top bar — mobile nav placeholder + wallet connect, since sidebar hides below lg */}
        <header className="flex items-center justify-between border-b border-hairline bg-parchment px-4 py-4 sm:px-8">
          <span className="font-display text-xl italic text-ink-text lg:hidden">PropChain</span>
          <div className="hidden lg:block">
            <h1 className="font-display text-2xl text-ink-text">Browse Assets</h1>
          </div>
          <button
            type="button"
            className="rounded-full border border-ink-text px-4 py-2 text-xs font-medium text-ink-text transition-colors hover:bg-ink-text hover:text-white"
          >
            Connect Wallet
          </button>
        </header>

        <section className="border-b border-hairline px-4 py-8 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-seal-gold">
            X Layer · AI-RWA
          </p>
          <h2 className="mt-2 max-w-xl font-display text-2xl italic leading-tight text-ink-text sm:text-3xl">
            Every listing here has been checked, before it was ever for sale.
          </h2>

          <div className="mt-5 inline-flex rounded-full border border-hairline bg-white p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors ${
                view === "grid" ? "bg-black text-white" : "text-muted hover:text-ink-text"
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors ${
                view === "list" ? "bg-black text-white" : "text-muted hover:text-ink-text"
              }`}
            >
              List
            </button>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-4 sm:px-8">
          {TYPES.map((type) => {
            const label = type === "All" ? "All Assets" : ASSET_TYPE_LABELS[type];
            const count = counts[type] ?? 0;
            const isActive = activeType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                  isActive
                    ? "border-black bg-black text-white"
                    : "border-hairline text-muted hover:border-ink-text hover:text-ink-text"
                }`}
              >
                {label} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        <main className="px-4 py-6 sm:px-8">
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="font-display text-xl italic text-ink-text/70">
                No listings in this category yet.
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((listing, i) => (
                <ListingCard key={listing.tokenId} listing={listing} index={i} />
              ))}
            </div>
          ) : (
            <div className="-mx-4 sm:-mx-8">
              {filtered.map((listing, i) => (
                <ListingRow key={listing.tokenId} listing={listing} index={i} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
