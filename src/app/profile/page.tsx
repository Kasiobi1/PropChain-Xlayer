"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/walletConnect";
import { useActiveNetwork } from "@/lib/useActiveNetwork";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { NetworkToggle } from "@/components/NetworkToggle";
import { AssetThumbnail } from "@/components/AssetThumbnail";
import { PriceTag } from "@/components/PriceTag";
import { OfferStatusBadge } from "@/components/OfferStatusBadge";
import { useProfileData, type ProfileOffer } from "@/lib/useProfileData";
import { useProfileImages } from "@/lib/useProfileImages";

type Tab = "owned" | "listed" | "made" | "received";

const TABS: { id: Tab; label: string }[] = [
  { id: "owned", label: "Owned" },
  { id: "listed", label: "Listed" },
  { id: "made", label: "Offers Made" },
  { id: "received", label: "Offers Received" },
];

function OfferRow({ offer, role }: { offer: ProfileOffer; role: "made" | "received" }) {
  return (
    <Link
      href={`/listing/real-${offer.tokenId}`}
      className="flex items-center justify-between gap-4 border-b border-hairline-dark px-4 py-4 transition-colors hover:bg-surface sm:px-6"
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-white">
          {offer.assetType} · Token #{offer.tokenId}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-text-secondary">
          {role === "made" ? "Seller: " : "Buyer: "}
          {offer.counterparty.slice(0, 6)}…{offer.counterparty.slice(-4)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-sm text-white">{offer.amountEth} ETH</span>
        <OfferStatusBadge status={offer.status} />
      </div>
    </Link>
  );
}

export default function ProfilePage() {
  const { address, connected: isConnected } = useWallet();
  const network = useActiveNetwork();
  const { owned, listed, offersMade, offersReceived, isLoading } = useProfileData();
  const [tab, setTab] = useState<Tab>("owned");
  const [imageError, setImageError] = useState<string | null>(null);
  const {
    avatarUrl,
    bannerUrl,
    hasCustomAvatar,
    hasCustomBanner,
    setAvatar,
    setBanner,
    resetAvatar,
    resetBanner,
  } = useProfileImages(address ?? undefined);

  function readAsDataUrl(file: File, onLoad: (dataUrl: string) => Promise<string | null>) {
    const reader = new FileReader();
    reader.onload = async () => {
      const error = await onLoad(reader.result as string);
      setImageError(error);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-hairline-dark bg-ink px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <MobileNav />
            <Link href="/" className="font-display text-xl italic text-white">
              PropChain
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NetworkToggle />
            <ConnectWalletButton />
          </div>
        </header>

        {!isConnected ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
            <p className="font-display text-xl italic text-white/70">Connect a wallet to view your profile</p>
            <p className="mt-2 max-w-sm text-sm text-text-secondary">
              Your owned assets, listings, and offers are tied to your wallet address — nothing
              to show until you connect one.
            </p>
          </div>
        ) : (
          <>
            <div className="group relative h-40 w-full overflow-hidden sm:h-48">
              {bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
              )}
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 text-xs font-medium text-white opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
                {hasCustomBanner ? "Change banner" : "Upload banner"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readAsDataUrl(f, setBanner);
                  }}
                />
              </label>
              {hasCustomBanner && (
                <button
                  type="button"
                  onClick={resetBanner}
                  className="absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] text-white opacity-0 transition-opacity hover:bg-ink group-hover:opacity-100"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="px-4 sm:px-8">
              {imageError && (
                <p className="mb-3 rounded-lg bg-clay/10 border border-clay/30 px-3 py-2 text-xs text-clay">
                  {imageError}
                </p>
              )}
              <div className="-mt-10 flex items-end gap-4">
                <div className="group/avatar relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-ink">
                  {avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 text-[9px] font-medium text-white opacity-0 transition-all group-hover/avatar:bg-black/50 group-hover/avatar:opacity-100">
                    {hasCustomAvatar ? "Change" : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) readAsDataUrl(f, setAvatar);
                      }}
                    />
                  </label>
                </div>
                {hasCustomAvatar && (
                  <button
                    type="button"
                    onClick={resetAvatar}
                    className="mb-1 text-[10px] text-text-secondary hover:text-white"
                  >
                    Reset to generated avatar
                  </button>
                )}
              </div>
              <p className="mt-3 font-mono text-sm text-white">
                {address?.slice(0, 8)}…{address?.slice(-6)}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {owned.length} owned · {listed.length} listed · {offersMade.length} offers made ·{" "}
                {offersReceived.length} offers received
              </p>
            </div>

            <div className="mt-6 flex gap-1 border-b border-hairline-dark px-4 sm:px-8">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    tab === t.id
                      ? "border-white text-white"
                      : "border-transparent text-text-secondary hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <main className="px-4 py-8 sm:px-8">
              {isLoading ? (
                <p className="text-sm text-text-secondary">
                  Reading your data from X Layer {network === "mainnet" ? "mainnet" : "testnet"}…
                </p>
              ) : (
                <>
                  {tab === "owned" &&
                    (owned.length === 0 ? (
                      <p className="text-sm text-text-secondary">
                        No assets owned by this wallet yet. Mint one via /admin/mint to test this.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {owned.map((asset) => (
                          <Link
                            key={asset.tokenId}
                            href={`/listing/real-${asset.tokenId}`}
                            className="block overflow-hidden rounded-lg border border-hairline-dark bg-surface transition-all hover:-translate-y-0.5 hover:shadow-xl"
                          >
                            <AssetThumbnail assetType={asset.assetType} seed={asset.tokenId} imageUrl={asset.imageUrls?.[0] ?? asset.imageUrl} />
                            <div className="p-3">
                              <p className="text-xs font-medium text-white">
                                {asset.assetType} · Token #{asset.tokenId}
                              </p>
                              <p className="mt-1 text-[11px] text-text-secondary">
                                {asset.isListed ? "Listed for sale" : "Not listed"}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ))}

                  {tab === "listed" &&
                    (listed.length === 0 ? (
                      <p className="text-sm text-text-secondary">
                        No active listings from this wallet. List an owned asset via /admin/mint
                        (step 3) to test this.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {listed.map((listing) => (
                          <Link
                            key={listing.tokenId}
                            href={`/listing/real-${listing.tokenId}`}
                            className="block overflow-hidden rounded-lg border border-hairline-dark bg-surface transition-all hover:-translate-y-0.5 hover:shadow-xl"
                          >
                            <AssetThumbnail assetType={listing.assetType} seed={listing.tokenId} imageUrl={listing.imageUrls?.[0] ?? listing.imageUrl} />
                            <div className="p-3">
                              <p className="text-xs font-medium text-white">
                                {listing.assetType} · Token #{listing.tokenId}
                              </p>
                              <div className="mt-1.5">
                                <PriceTag listing={listing} />
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ))}

                  {tab === "made" &&
                    (offersMade.length === 0 ? (
                      <p className="text-sm text-text-secondary">
                        No offers made from this wallet yet.
                      </p>
                    ) : (
                      <div className="rounded-xl border border-hairline-dark">
                        {offersMade.map((offer) => (
                          <OfferRow key={offer.offerId} offer={offer} role="made" />
                        ))}
                      </div>
                    ))}

                  {tab === "received" &&
                    (offersReceived.length === 0 ? (
                      <p className="text-sm text-text-secondary">
                        No offers received on your listings yet.
                      </p>
                    ) : (
                      <div className="rounded-xl border border-hairline-dark">
                        {offersReceived.map((offer) => (
                          <OfferRow key={offer.offerId} offer={offer} role="received" />
                        ))}
                      </div>
                    ))}
                </>
              )}
            </main>
          </>
        )}

        <SiteFooter />
      </div>
    </div>
  );
}
