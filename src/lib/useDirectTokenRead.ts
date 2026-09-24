"use client";

import { useEffect, useState } from "react";
import { CONTRACT_ADDRESSES } from "./contracts";
import { ASSET_NFT_ABI, ASSET_TYPE_ENUM } from "./assetNftAbi";
import { decodeMetadataDataUri, getMetadataImageUrls } from "./assetMetadata";
import { getPublicClient } from "./walletConnect";
import type { AssetType } from "./mockListings";

export interface DirectTokenInfo {
  tokenId: number;
  exists: boolean;
  owner: `0x${string}` | null;
  assetType: AssetType;
  name: string;
  description: string;
  location: string;
  imageUrls: string[];
  docHashFull: string;
  verificationId: string;
}

/**
 * Reads a token's data straight from AssetNFT — ownerOf, tokenURI,
 * assetData — with no dependency on Marketplace listing status at all.
 * useRealListings.ts only ever surfaces tokens with an Active Marketplace
 * listing, so a token that's been sold, or one that was minted but never
 * listed, simply isn't in that array — this hook exists for exactly that
 * gap, so a token's page can still show something real (and its transfer
 * history, see useTokenTransferHistory.ts) instead of a dead end.
 *
 * `exists: false` specifically means ownerOf reverted — the standard
 * ERC-721 way a contract signals "no such token" — as opposed to some
 * other read failure (RPC hiccup), which surfaces via the hook's `error`
 * instead so the two cases aren't confused with each other.
 *
 * Migrated off wagmi's useReadContracts to a plain viem multicall against
 * the injected wallet provider (see walletConnect.ts) — same
 * three-call shape, just issued directly instead of through a wagmi
 * connector.
 */
export function useDirectTokenRead(tokenId: number | undefined) {
  const [info, setInfo] = useState<DirectTokenInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (tokenId === undefined) {
      setInfo(null);
      return;
    }

    const client = getPublicClient();
    if (!client) {
      setError(new Error("No wallet provider found."));
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    client
      .multicall({
        contracts: [
          {
            address: CONTRACT_ADDRESSES.assetNFT,
            abi: ASSET_NFT_ABI,
            functionName: "ownerOf",
            args: [BigInt(tokenId)],
          },
          {
            address: CONTRACT_ADDRESSES.assetNFT,
            abi: ASSET_NFT_ABI,
            functionName: "tokenURI",
            args: [BigInt(tokenId)],
          },
          {
            address: CONTRACT_ADDRESSES.assetNFT,
            abi: ASSET_NFT_ABI,
            functionName: "assetData",
            args: [BigInt(tokenId)],
          },
        ],
      })
      .then(([ownerResult, uriResult, assetDataResult]) => {
        if (cancelled) return;

        if (ownerResult.status === "failure") {
          setInfo({
            tokenId,
            exists: false,
            owner: null,
            assetType: "Other",
            name: `Real Asset #${tokenId}`,
            description: "",
            location: "",
            imageUrls: [],
            docHashFull: "",
            verificationId: "",
          });
          return;
        }

        const owner = ownerResult.result as `0x${string}`;
        const metadata =
          uriResult.status === "success" ? decodeMetadataDataUri(uriResult.result as string) : null;

        let assetType: AssetType = "Other";
        let docHashFull = "";
        let verificationId = "";
        if (assetDataResult.status === "success") {
          const [typeIndex, , , docHash, vId] = assetDataResult.result as readonly [
            number,
            `0x${string}`,
            bigint,
            `0x${string}`,
            `0x${string}`,
            bigint,
            boolean,
          ];
          assetType = ASSET_TYPE_ENUM[typeIndex] ?? "Other";
          docHashFull = docHash;
          verificationId = vId;
        }

        setInfo({
          tokenId,
          exists: true,
          owner,
          assetType,
          name: metadata?.name ?? `Real Asset #${tokenId}`,
          description:
            metadata?.description ??
            "This asset was minted before real metadata support was added, so no description is available.",
          location: metadata?.location ?? "Location not set",
          imageUrls: getMetadataImageUrls(metadata),
          docHashFull,
          verificationId,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  return { info, isLoading, error };
}
