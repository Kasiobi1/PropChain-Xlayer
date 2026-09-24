"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEther } from "viem";
import { CONTRACT_ADDRESSES } from "./contracts";
import { ASSET_NFT_ABI, ASSET_TYPE_ENUM } from "./assetNftAbi";
import { MARKETPLACE_ABI } from "./marketplaceAbi";
import { decodeMetadataDataUri, getMetadataImageUrls, normalizeImageUrl } from "./assetMetadata";
import { getPublicClient } from "./walletConnect";
import type { Listing } from "./mockListings";

const LISTING_STATUS = ["None", "Active", "Sold", "Cancelled"] as const;

/**
 * Reads every real on-chain listing by walking token IDs 1..nextTokenId-1.
 * There's no bulk "getAllListings()" view on Marketplace.sol yet — adding
 * one means a redeploy, which would orphan any assets already minted on the
 * current contract. At hackathon scale (a handful of tokens) this
 * token-by-token approach is fine; revisit with an indexer/subgraph or a
 * real getAllListings() function if the catalog grows large.
 *
 * Returns ONLY listings with status === Active (mirrors what mock data
 * always assumed — every mock listing was implicitly "active"). Sold/
 * cancelled/never-listed tokens are filtered out.
 *
 * Migrated off wagmi's useReadContract/useReadContracts to plain viem
 * calls against the injected wallet provider (see walletConnect.ts) —
 * same two-pass (count, then per-token multicall) shape as before.
 */
export function useRealListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    const client = getPublicClient();
    if (!client) {
      setError(new Error("No wallet provider found."));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextTokenId = (await client.readContract({
        address: CONTRACT_ADDRESSES.assetNFT,
        abi: ASSET_NFT_ABI,
        functionName: "nextTokenId",
      })) as bigint;

      // Token IDs are 1..nextTokenId-1 (nextTokenId starts at 1 and
      // increments after each mint, so if nextTokenId is 3, tokens 1 and
      // 2 exist).
      const tokenCount = nextTokenId ? Number(nextTokenId) - 1 : 0;
      const tokenIds = Array.from({ length: Math.max(tokenCount, 0) }, (_, i) => BigInt(i + 1));

      if (tokenIds.length === 0) {
        setListings([]);
        return;
      }

      const contracts = tokenIds.flatMap((id) => [
        {
          address: CONTRACT_ADDRESSES.assetNFT,
          abi: ASSET_NFT_ABI,
          functionName: "assetData",
          args: [id],
        } as const,
        {
          address: CONTRACT_ADDRESSES.marketplace,
          abi: MARKETPLACE_ABI,
          functionName: "listings",
          args: [id],
        } as const,
        {
          address: CONTRACT_ADDRESSES.assetNFT,
          abi: ASSET_NFT_ABI,
          functionName: "tokenURI",
          args: [id],
        } as const,
      ]);

      const data = await client.multicall({ contracts });

      const result: Listing[] = [];

      for (let i = 0; i < tokenIds.length; i++) {
        const assetDataResult = data[i * 3];
        const listingResult = data[i * 3 + 1];
        const tokenUriResult = data[i * 3 + 2];

        if (assetDataResult?.status !== "success" || listingResult?.status !== "success") continue;

        const [assetType, , supply, docHash, verificationId] =
          assetDataResult.result as readonly [
            number,
            `0x${string}`,
            bigint,
            `0x${string}`,
            `0x${string}`,
            bigint,
            boolean,
          ];
        const [seller, floorPrice, currentPrice, status] = listingResult.result as readonly [
          `0x${string}`,
          bigint,
          bigint,
          number,
        ];

        // Only surface active listings — matches what every mock listing
        // implicitly assumed (there was no "unlisted" state in mock data).
        if (LISTING_STATUS[status] !== "Active") continue;

        const tokenId = Number(tokenIds[i]);
        const floorPriceEth = Number(formatEther(floorPrice));
        const currentPriceEth = Number(formatEther(currentPrice));

        // Decode real metadata from tokenURI if it's a data: URI (see
        // assetMetadata.ts) — older tokens minted before that fix will
        // have the old placeholder ipfs://placeholder/... string instead,
        // which decodeMetadataDataUri correctly returns null for, falling
        // back to the generic labels below.
        const tokenUri = tokenUriResult?.status === "success" ? (tokenUriResult.result as string) : "";
        const metadata = decodeMetadataDataUri(tokenUri);

        result.push({
          tokenId,
          assetType: ASSET_TYPE_ENUM[assetType] ?? "Other",
          name: metadata?.name || `Real Asset #${tokenId}`,
          location: metadata?.location || "Location not set",
          seller,
          sellerName: `${seller.slice(0, 6)}…${seller.slice(-4)}`, // no off-chain profile system yet
          floorPriceEth,
          currentPriceEth,
          priceDirection:
            currentPriceEth > floorPriceEth ? "up" : currentPriceEth < floorPriceEth ? "down" : "unchanged",
          verified: true,
          verifiedDate: "—", // mintedAt is available but not formatted here yet
          imageQuery: "",
          imageUrl: metadata?.imageUrl ? normalizeImageUrl(metadata.imageUrl) : undefined,
          imageUrls: getMetadataImageUrls(metadata),
          offerCount: 0, // would need a separate read of offersByAsset(tokenId).length
          docHashShort: `${docHash.slice(0, 8)}…${docHash.slice(-6)}`,
          docHashFull: docHash,
          supply: Number(supply),
          description:
            metadata?.description ||
            "This asset was minted before real metadata support was added, so no description is available — only the placeholder used at the time.",
          verificationId: `${verificationId.slice(0, 8)}…${verificationId.slice(-6)}`,
          batchId: metadata?.batchId,
          verifiedOrg: metadata?.verifiedOrg ?? false,
        });
      }

      setListings(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    listings,
    isLoading,
    error,
    // Forces a fresh on-chain read of both the token count and every
    // token's data — used by the listing detail page to retry a "not
    // found yet" listing (right after minting, the RPC may briefly lag
    // behind, or the List transaction may not be confirmed yet) instead
    // of trusting whatever was cached from the initial page load.
    refetch: load,
  };
}
