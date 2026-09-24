"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { CONTRACT_ADDRESSES } from "./contracts";
import { ASSET_NFT_ABI, ASSET_TYPE_ENUM } from "./assetNftAbi";
import { MARKETPLACE_ABI } from "./marketplaceAbi";
import { useRealListings } from "./useRealListings";
import { useWallet, getPublicClient } from "./walletConnect";
import { decodeMetadataDataUri, getMetadataImageUrls, normalizeImageUrl } from "./assetMetadata";
import type { AssetType } from "./mockListings";

const OFFER_STATUS = ["None", "Pending", "Countered", "Accepted", "Rejected", "Withdrawn", "Expired"] as const;

export interface ProfileOwnedAsset {
  tokenId: number;
  assetType: AssetType;
  isListed: boolean;
  imageUrl?: string;
  imageUrls?: string[];
}

export interface ProfileOffer {
  offerId: number;
  tokenId: number;
  assetType: AssetType;
  amountEth: number;
  status: "Pending" | "Countered" | "Accepted" | "Rejected" | "Withdrawn" | "Expired";
  expiry: number; // unix seconds
  isSellerCounter: boolean;
  counterparty: `0x${string}`; // the OTHER side of the offer — seller for "made", buyer for "received"
}

/**
 * Reads everything the connected wallet owns, has listed, and has active
 * offers on/from — for the /profile page. Same token-by-token scanning
 * approach as useRealListings.ts (no bulk enumeration function exists on
 * either contract yet — see that file's comment for why this is an
 * acceptable tradeoff at current scale).
 *
 * This is read-heavy: for N minted tokens, it makes ~N ownerOf calls, N
 * assetData calls, N getOffersForAsset calls, and then one offers() call
 * per offer ID found. Fine for a handful of tokens; would need real
 * indexing (subgraph, or a backend cache) before this scales past maybe a
 * few dozen assets.
 *
 * Migrated off wagmi's useAccount/useReadContract/useReadContracts to
 * useWallet() (address) and sequential viem multicalls (this hook's
 * offer lookup genuinely depends on a prior call's result — getting the
 * offer IDs before it can read the offers themselves — so it's expressed
 * here as an explicit async sequence rather than wagmi's declarative
 * dependent-query pattern).
 */
export function useProfileData() {
  const { address } = useWallet();
  const { listings: realListings, isLoading: isLoadingListings } = useRealListings();

  const [owned, setOwned] = useState<ProfileOwnedAsset[]>([]);
  const [offersMade, setOffersMade] = useState<ProfileOffer[]>([]);
  const [offersReceived, setOffersReceived] = useState<ProfileOffer[]>([]);
  const [isLoadingChain, setIsLoadingChain] = useState(false);

  useEffect(() => {
    if (!address) {
      setOwned([]);
      setOffersMade([]);
      setOffersReceived([]);
      return;
    }

    const client = getPublicClient();
    if (!client) return;

    let cancelled = false;
    setIsLoadingChain(true);

    async function run(address: `0x${string}`) {
      const nextTokenId = (await client!.readContract({
        address: CONTRACT_ADDRESSES.assetNFT,
        abi: ASSET_NFT_ABI,
        functionName: "nextTokenId",
      })) as bigint;

      const tokenCount = nextTokenId ? Number(nextTokenId) - 1 : 0;
      const tokenIds = Array.from({ length: Math.max(tokenCount, 0) }, (_, i) => BigInt(i + 1));

      if (tokenIds.length === 0) {
        if (!cancelled) {
          setOwned([]);
          setOffersMade([]);
          setOffersReceived([]);
        }
        return;
      }

      // --- Stage 1: ownership + asset type for every minted token, so
      // "Owned" doesn't depend on a listing existing at all (an unlisted
      // asset is still owned).
      const ownerContracts = tokenIds.flatMap((id) => [
        {
          address: CONTRACT_ADDRESSES.assetNFT,
          abi: ASSET_NFT_ABI,
          functionName: "ownerOf",
          args: [id],
        } as const,
        {
          address: CONTRACT_ADDRESSES.assetNFT,
          abi: ASSET_NFT_ABI,
          functionName: "assetData",
          args: [id],
        } as const,
        {
          address: CONTRACT_ADDRESSES.assetNFT,
          abi: ASSET_NFT_ABI,
          functionName: "tokenURI",
          args: [id],
        } as const,
      ]);

      const ownerData = await client!.multicall({ contracts: ownerContracts });

      const ownedResult: ProfileOwnedAsset[] = [];
      for (let i = 0; i < tokenIds.length; i++) {
        const ownerResult = ownerData[i * 3];
        const assetDataResult = ownerData[i * 3 + 1];
        const tokenUriResult = ownerData[i * 3 + 2];
        if (ownerResult?.status !== "success" || assetDataResult?.status !== "success") continue;

        const owner = ownerResult.result as `0x${string}`;
        if (owner.toLowerCase() !== address.toLowerCase()) continue;

        const [assetType] = assetDataResult.result as readonly [number, ...unknown[]];
        const tokenId = Number(tokenIds[i]);
        const tokenUri = tokenUriResult?.status === "success" ? (tokenUriResult.result as string) : "";
        const metadata = decodeMetadataDataUri(tokenUri);
        ownedResult.push({
          tokenId,
          assetType: ASSET_TYPE_ENUM[assetType] ?? "Other",
          isListed: realListings.some((l) => l.tokenId === tokenId),
          imageUrl: metadata?.imageUrl ? normalizeImageUrl(metadata.imageUrl) : undefined,
          imageUrls: getMetadataImageUrls(metadata),
        });
      }

      // --- Stage 2: offer IDs per asset, across every minted token.
      const offerIdContracts = tokenIds.map(
        (id) =>
          ({
            address: CONTRACT_ADDRESSES.marketplace,
            abi: MARKETPLACE_ABI,
            functionName: "getOffersForAsset",
            args: [id],
          }) as const
      );
      const offerIdData = await client!.multicall({ contracts: offerIdContracts });

      const allOfferIds: { tokenId: number; offerId: bigint }[] = [];
      offerIdData.forEach((result, i) => {
        if (result.status !== "success") return;
        const ids = result.result as readonly bigint[];
        ids.forEach((offerId) => {
          allOfferIds.push({ tokenId: Number(tokenIds[i]), offerId });
        });
      });

      // --- Stage 3: read each Offer found in stage 2.
      const madeResult: ProfileOffer[] = [];
      const receivedResult: ProfileOffer[] = [];

      if (allOfferIds.length > 0) {
        const offerContracts = allOfferIds.map(
          ({ offerId }) =>
            ({
              address: CONTRACT_ADDRESSES.marketplace,
              abi: MARKETPLACE_ABI,
              functionName: "offers",
              args: [offerId],
            }) as const
        );
        const offerData = await client!.multicall({ contracts: offerContracts });

        offerData.forEach((result, i) => {
          if (result.status !== "success") return;
          const [buyer, assetIdRaw, amount, expiry, status, isSellerCounter] = result.result as readonly [
            `0x${string}`,
            bigint,
            bigint,
            bigint,
            number,
            boolean,
          ];

          const tokenId = Number(assetIdRaw);
          const listingForAsset = realListings.find((l) => l.tokenId === tokenId);
          const seller = listingForAsset?.seller;
          const assetType = listingForAsset?.assetType ?? "Other";
          const statusLabel = OFFER_STATUS[status];

          // "None" means the offer ID slot is empty/never existed — skip
          // it rather than try to render a status our badge component
          // doesn't know.
          if (statusLabel === "None" || !statusLabel) return;

          const offer: ProfileOffer = {
            offerId: Number(allOfferIds[i].offerId),
            tokenId,
            assetType,
            amountEth: Number(formatEther(amount)),
            status: statusLabel,
            expiry: Number(expiry),
            isSellerCounter,
            counterparty: (buyer.toLowerCase() === address.toLowerCase() ? seller : buyer) ?? "0x0",
          };

          if (buyer.toLowerCase() === address.toLowerCase()) {
            madeResult.push(offer);
          } else if (seller && seller.toLowerCase() === address.toLowerCase()) {
            receivedResult.push(offer);
          }
        });
      }

      if (!cancelled) {
        setOwned(ownedResult);
        setOffersMade(madeResult);
        setOffersReceived(receivedResult);
      }
    }

    run(address).finally(() => {
      if (!cancelled) setIsLoadingChain(false);
    });

    return () => {
      cancelled = true;
    };
    // realListings intentionally omitted — it changes identity every
    // render from useRealListings' own state, which would otherwise
    // re-trigger this entire multi-stage read loop continuously. isListed
    // and counterparty/assetType lookups already read from whatever
    // realListings snapshot was in scope when run() executed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const isLoading = isLoadingListings || isLoadingChain;

  if (!address || isLoading) {
    return { owned: [], listed: [], offersMade: [], offersReceived: [], isLoading };
  }

  const listed = realListings.filter((l) => l.seller.toLowerCase() === address.toLowerCase());

  return { owned, listed, offersMade, offersReceived, isLoading: false };
}
