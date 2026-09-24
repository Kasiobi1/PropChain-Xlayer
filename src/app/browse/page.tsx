"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { ListingRow } from "@/components/ListingRow";
import { ListingCard } from "@/components/ListingCard";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import { SiteFooter } from "@/components/SiteFooter";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { NetworkToggle } from "@/components/NetworkToggle";
import { MOCK_LISTINGS, ASSET_TYPE_LABELS, type AssetType } from "@/lib/mockListings";
import { useRealListings } from "@/lib/useRealListings";
import { useActiveNetwork } from "@/lib/useActiveNetwork";
import { groupListingsIntoBatches } from "@/lib/batches";

function BrowseContent() {
  const network = useActiveNetwork();
  const searchParams = useSearchParams();
  const sort = searchParams.get("sort"); // "highest" | "newest" | null — driven by hero slideshow CTAs

  const { listings: realListings, isLoading: isLoadingReal } = useRealListings();

  const [activeType, setActiveType] = useState<AssetType | "All">(() => {
    const typeParam = searchParams.get("type");
    const validTypes: (AssetType | "All")[] = ["House", "Land", "Phone", "Gadget", "Car", "Other"];
    return typeParam && validTypes.includes(typeParam as AssetType) ? (typeParam as AssetType) : "All";
  });
  const [view, setView] = useState<"list" | "grid">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sidebar's "Search" link points here as /browse#search — this focuses
  // the existing search input on arrival instead of building a separate
  // search page, so there's one search implementation to keep working,
  // not two. Mobile reaches the same input by just scrolling to it, since
  // there's no separate desktop-only sidebar there.
  useEffect(() => {
    if (window.location.hash === "#search") {
      searchInputRef.current?.focus();
    }
  }, []);

  const counts = useMemo(() => {
    // On mainnet there's no fake data to fall back to — real listings
    // (or lack of them) are the only honest source for these counts.
    // Using MOCK_LISTINGS' counts here would keep showing "Houses 3"
    // etc. even once the demo section itself is hidden, which would
    // make the filter chips look like they're counting real inventory
    // that doesn't exist yet.
    const source = network === "mainnet" ? realListings : MOCK_LISTINGS;
    const c: Record<string, number> = { All: source.length };
    for (const l of source) {
      c[l.assetType] = (c[l.assetType] ?? 0) + 1;
    }
    return c;
  }, [network, realListings]);

  // Matches asset name, seller wallet address (full or truncated), or
  // seller display name — the same match logic works for real listings
  // once on-chain profile names exist (sellerName currently falls back to
  // a truncated address for real listings, see useRealListings.ts), no
  // change needed here when that ships.
  function matchesSearch(listing: { name: string; seller: string; sellerName: string }, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      listing.name.toLowerCase().includes(q) ||
      listing.seller.toLowerCase().includes(q) ||
      listing.sellerName.toLowerCase().includes(q)
    );
  }

  const filtered = useMemo(() => {
    const base =
      activeType === "All" ? MOCK_LISTINGS : MOCK_LISTINGS.filter((l) => l.assetType === activeType);
    const searched = base.filter((l) => matchesSearch(l, searchQuery));

    if (sort === "highest") {
      return [...searched].sort((a, b) => b.currentPriceEth - a.currentPriceEth);
    }
    if (sort === "newest") {
      return [...searched].sort((a, b) => (a.verifiedDate < b.verifiedDate ? 1 : -1));
    }
    return searched;
  }, [activeType, sort, searchQuery]);

  const filteredReal = useMemo(() => {
    const base =
      activeType === "All" ? realListings : realListings.filter((l) => l.assetType === activeType);
    const searched = base.filter((l) => matchesSearch(l, searchQuery));
    const sorted =
      sort === "highest" ? [...searched].sort((a, b) => b.currentPriceEth - a.currentPriceEth) : searched;
    // Collapses N identical units (same batchId) into one card — see
    // src/lib/batches.ts. A card for a batch links to its representative
    // (lowest tokenId), and the listing detail page's quantity selector
    // handles buying more than one from there.
    return groupListingsIntoBatches(sorted);
  }, [realListings, activeType, sort, searchQuery]);

  const TYPES: (AssetType | "All")[] = ["All", "House", "Land", "Phone", "Gadget", "Car"];

  return (
    <div className="flex min-h-full bg-ink">
      <Sidebar />

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-hairline-dark bg-ink px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <MobileNav />
            <span className="font-display text-xl italic text-white lg:hidden">PropChain</span>
            <h1 className="hidden font-display text-2xl text-white lg:block">Browse Assets</h1>
          </div>
          <div className="flex items-center gap-2">
            <NetworkToggle />
            <ConnectWalletButton />
          </div>
        </header>

        <div className="px-4 pt-6 sm:px-8">
          <HeroSlideshow />
        </div>

        <section className="border-b border-hairline-dark px-4 py-8 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-seal-gold-soft">
            X Layer · AI-RWA
          </p>
          <h2 className="mt-2 max-w-xl font-display text-2xl italic leading-tight text-white sm:text-3xl">
            Every listing here has been checked, before it was ever for sale.
          </h2>

          <div className="mt-5 inline-flex rounded-full border border-hairline-dark bg-surface p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors ${
                view === "grid" ? "bg-white text-black" : "text-text-secondary hover:text-white"
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors ${
                view === "list" ? "bg-white text-black" : "text-text-secondary hover:text-white"
              }`}
            >
              List
            </button>
          </div>
        </section>

        <div id="search" className="border-b border-hairline-dark px-4 py-4 sm:px-8">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by asset name, seller name, or wallet address (0x…)"
            className="w-full rounded-full border border-hairline-dark bg-surface px-4 py-2.5 text-sm text-white placeholder:text-text-secondary outline-none focus:border-white/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-hairline-dark px-4 py-4 sm:px-8">
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
                    ? "border-white bg-white text-black"
                    : "border-hairline-dark text-text-secondary hover:border-white/50 hover:text-white"
                }`}
              >
                {label} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {(isLoadingReal || filteredReal.length > 0) && (
          <section className="border-b border-hairline-dark px-4 py-8 sm:px-8">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl text-white">On-chain listings</h2>
              <span className="rounded-full bg-sage/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-sage">
                Live
              </span>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              Real assets minted and listed on the deployed Marketplace contract
              {network === "mainnet"
                ? "."
                : " — everything below this section is demo data."}
            </p>

            {isLoadingReal ? (
              <p className="mt-6 text-sm text-text-secondary">
                Reading listings from X Layer {network === "mainnet" ? "mainnet" : "testnet"}…
              </p>
            ) : view === "grid" ? (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {filteredReal.map(({ representative, activeTokenIds }, i) => (
                  <ListingCard
                    key={representative.tokenId}
                    listing={representative}
                    index={i}
                    hrefPrefix="real-"
                    availableCount={activeTokenIds.length}
                  />
                ))}
              </div>
            ) : (
              <div className="-mx-4 mt-6 sm:-mx-8">
                {filteredReal.map(({ representative, activeTokenIds }, i) => (
                  <ListingRow
                    key={representative.tokenId}
                    listing={representative}
                    index={i}
                    hrefPrefix="real-"
                    availableCount={activeTokenIds.length}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {network === "mainnet" ? (
          // No demo/sample data on mainnet — real assets on mainnet mean
          // real tokens, not the testnet demo content used for the demo
          // video. If there's nothing in the "On-chain listings" section
          // above (and it's done loading), show a real empty state
          // instead of silently showing nothing.
          !isLoadingReal &&
          filteredReal.length === 0 && (
            <main className="px-4 py-20 sm:px-8">
              <div className="py-20 text-center">
                <p className="font-display text-xl italic text-white/70">
                  No assets listed on X Layer mainnet yet.
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  Real listings will appear here once sellers mint and list on mainnet.
                </p>
              </div>
            </main>
          )
        ) : (
          <main className="px-4 py-6 sm:px-8">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="font-display text-xl text-white">Demo listings</h2>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary">
                Sample data
              </span>
            </div>
            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <p className="font-display text-xl italic text-white/70">
                  No listings in this category yet.
                </p>
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
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
        )}

        <SiteFooter />
      </div>
    </div>
  );
}


export default function BrowsePage() {
  return (
    <Suspense fallback={null}>
      <BrowseContent />
    </Suspense>
  );
}
