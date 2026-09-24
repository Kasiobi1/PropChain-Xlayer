"use client";

import { useEffect, useState } from "react";
import { formatEther, type Address } from "viem";
import { CONTRACT_ADDRESSES } from "./contracts";
import { ASSET_NFT_ABI, ASSET_TYPE_ENUM } from "./assetNftAbi";
import { MARKETPLACE_ABI } from "./marketplaceAbi";
import { decodeMetadataDataUri } from "./assetMetadata";
import { getPublicClient } from "./walletConnect";
import { scanLogsInChunks, type ChainPublicClient, type ScanProgress } from "./chainScan";
import type { AssetType } from "./mockListings";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface WalletTransaction {
  tokenId: number;
  role: "buyer" | "seller";
  counterparty: Address;
  // null for a transfer-sourced row — a raw ERC-721 Transfer event carries
  // no payment info, only Marketplace's AssetPurchased event does.
  priceEth: number | null;
  assetType: AssetType;
  name: string;
  blockNumber: bigint;
  txHash: `0x${string}`;
  // "buyNow" = a confirmed Marketplace purchase, with a real price.
  // "transfer" = the NFT moved between these two addresses some other way
  // (an accepted offer, a direct wallet-to-wallet transfer, or any other
  // Marketplace function this project doesn't have a verified ABI entry
  // for) — see the comment above fetchAllTransferLogs for why this can't
  // be labeled more specifically than "not a Buy Now".
  source: "buyNow" | "transfer";
}

export type { ScanProgress };

const ASSET_PURCHASED_EVENT = MARKETPLACE_ABI.find(
  (item) => item.type === "event" && item.name === "AssetPurchased"
);
const TRANSFER_EVENT = ASSET_NFT_ABI.find((item) => item.type === "event" && item.name === "Transfer");

// Cached at module scope (not per-hook-call) since these are expensive and
// identical for every user of this page in a given browser session — the
// full event history is the same regardless of which address someone is
// looking up. A second address search in the same session reads straight
// from this cache instead of re-scanning the chain.
let allPurchaseLogsPromise: ReturnType<typeof fetchAllPurchaseLogs> | null = null;
let allTransferLogsPromise: ReturnType<typeof fetchAllTransferLogs> | null = null;

interface DecodedPurchase {
  assetId: bigint;
  buyer: Address;
  seller: Address;
  price: bigint;
  blockNumber: bigint;
  txHash: `0x${string}`;
  logIndex: number;
}

interface DecodedTransfer {
  tokenId: bigint;
  from: Address;
  to: Address;
  blockNumber: bigint;
  txHash: `0x${string}`;
  logIndex: number;
}

/**
 * Scans the full AssetPurchased history once (no buyer/seller filter — one
 * pass covers every address that will ever be looked up on this page) and
 * caches it at module scope. Reports progress via onProgress since a first
 * cold scan across many 100-block chunks is genuinely slow, not instant.
 */
async function fetchAllPurchaseLogs(client: ChainPublicClient, onProgress: (p: ScanProgress) => void) {
  if (!ASSET_PURCHASED_EVENT) {
    throw new Error("AssetPurchased event not found in MARKETPLACE_ABI — ABI may be out of date.");
  }
  return scanLogsInChunks(
    client,
    CONTRACT_ADDRESSES.marketplace,
    ASSET_PURCHASED_EVENT,
    undefined,
    onProgress,
    (log) => {
      const args = log.args as { assetId: bigint; buyer: Address; seller: Address; price: bigint };
      return {
        assetId: args.assetId,
        buyer: args.buyer,
        seller: args.seller,
        price: args.price,
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? "0x0",
        logIndex: log.logIndex ?? 0,
      } satisfies DecodedPurchase;
    }
  );
}

/**
 * Scans AssetNFT's standard ERC-721 Transfer history — this catches sales
 * completed some way other than Marketplace's buyNow (most likely an
 * accepted offer). `acceptOffer` / `counterOffer` / `OfferAccepted` don't
 * exist anywhere in this codebase's marketplaceAbi.ts — only `makeOffer` /
 * `OfferMade` do — so there's no verified event to scan for that specific
 * mechanism. But whatever function completes a sale still has to move the
 * NFT, and Transfer is part of the EIP-721 spec every ERC-721 contract
 * emits, so this works without needing to know or guess that function's
 * signature. The tradeoff: a raw Transfer carries no price, and can't
 * distinguish "sold via offer" from "gifted with no payment" from any
 * other reason the owner called transferFrom directly — so these show up
 * generically as "Transferred", not "Sold via offer".
 */
async function fetchAllTransferLogs(client: ChainPublicClient, onProgress: (p: ScanProgress) => void) {
  if (!TRANSFER_EVENT) {
    throw new Error("Transfer event not found in ASSET_NFT_ABI — ABI may be out of date.");
  }
  return scanLogsInChunks(client, CONTRACT_ADDRESSES.assetNFT, TRANSFER_EVENT, undefined, onProgress, (log) => {
    const args = log.args as { from: Address; to: Address; tokenId: bigint };
    return {
      tokenId: args.tokenId,
      from: args.from,
      to: args.to,
      blockNumber: log.blockNumber ?? 0n,
      txHash: log.transactionHash ?? "0x0",
      logIndex: log.logIndex ?? 0,
    } satisfies DecodedTransfer;
  });
}

/**
 * Real on-chain buy/sell history for a given address — completed transfers
 * only, never live offers or current listings. That scope is deliberate,
 * not a shortcut: this page exists so anyone can paste an address and see
 * a plain transaction record, and "offer" isn't a transaction yet — it's a
 * pending, cancellable, still-negotiable state. Offers-made/offers-received
 * already exist on /profile for the connected wallet's own pending offers.
 *
 * Two sources, merged: Marketplace's AssetPurchased (buyNow, real price)
 * and AssetNFT's standard Transfer (catches everything else, including
 * accepted offers, but with no price attached) — see fetchAllTransferLogs'
 * comment for why the second source can't be labeled more specifically.
 *
 * `truncatedFromBlock` is set when the real history is too long to fully
 * scan (see chainScan.ts) — the earliest block actually covered, so the
 * page can say "showing activity since block X" instead of silently
 * implying complete history.
 */
export function useWalletTransactions(address: Address | undefined) {
  // getPublicClient() reads window.ethereum directly rather than through a
  // wagmi hook — see walletConnect.ts. It's cheap to call per-render (no
  // network I/O until a method is actually invoked), so it's fine to call
  // plainly here instead of memoizing.
  const publicClient = getPublicClient();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [truncatedFromBlock, setTruncatedFromBlock] = useState<bigint | null>(null);

  useEffect(() => {
    if (!address || !publicClient) {
      setTransactions([]);
      setError(null);
      setProgress(null);
      setTruncatedFromBlock(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setProgress(null);

    (async () => {
      try {
        const client = publicClient as ChainPublicClient;

        allPurchaseLogsPromise ??= fetchAllPurchaseLogs(client, (p) => {
          if (!cancelled) setProgress(p);
        }).catch((err) => {
          allPurchaseLogsPromise = null; // allow retry on the next lookup instead of caching a failure forever
          throw err;
        });
        const purchaseScan = await allPurchaseLogsPromise;

        allTransferLogsPromise ??= fetchAllTransferLogs(client, (p) => {
          if (!cancelled) setProgress(p);
        }).catch((err) => {
          allTransferLogsPromise = null;
          throw err;
        });
        const transferScan = await allTransferLogsPromise;

        if (!cancelled) {
          const earliestScanned =
            purchaseScan.scannedFromBlock < transferScan.scannedFromBlock
              ? purchaseScan.scannedFromBlock
              : transferScan.scannedFromBlock;
          setTruncatedFromBlock(purchaseScan.truncated || transferScan.truncated ? earliestScanned : null);
        }

        const allPurchases = purchaseScan.logs;
        const allTransfers = transferScan.logs;

        const purchaseMatches = allPurchases.filter(
          (log) => log.buyer.toLowerCase() === address.toLowerCase() || log.seller.toLowerCase() === address.toLowerCase()
        );
        const purchaseTxHashes = new Set(purchaseMatches.map((log) => log.txHash.toLowerCase()));

        // Excludes: mint transfers (from the zero address — not a sale),
        // and any transfer whose tx hash already matched a buyNow purchase
        // above (buyNow's own execution emits this same Transfer event as
        // a side effect — without this check every Buy Now would show up
        // twice, once with a real price and once without).
        const transferMatches = allTransfers.filter(
          (log) =>
            log.from.toLowerCase() !== ZERO_ADDRESS &&
            !purchaseTxHashes.has(log.txHash.toLowerCase()) &&
            (log.from.toLowerCase() === address.toLowerCase() || log.to.toLowerCase() === address.toLowerCase())
        );

        async function resolveAssetInfo(tokenId: bigint) {
          let assetType: AssetType = "Other";
          let name = `Real Asset #${tokenId}`;
          try {
            const [assetData, tokenUri] = await Promise.all([
              client.readContract({
                address: CONTRACT_ADDRESSES.assetNFT,
                abi: ASSET_NFT_ABI,
                functionName: "assetData",
                args: [tokenId],
              }),
              client.readContract({
                address: CONTRACT_ADDRESSES.assetNFT,
                abi: ASSET_NFT_ABI,
                functionName: "tokenURI",
                args: [tokenId],
              }),
            ]);
            const [typeIndex] = assetData as readonly [number, ...unknown[]];
            assetType = ASSET_TYPE_ENUM[typeIndex] ?? "Other";
            const metadata = decodeMetadataDataUri(tokenUri as string);
            if (metadata?.name) name = metadata.name;
          } catch {
            // Token read failed (RPC hiccup, or token since burned/altered)
            // — fall back to the generic label rather than dropping the
            // whole row; the transaction itself is still real.
          }
          return { assetType, name };
        }

        const purchaseResults = await Promise.all(
          purchaseMatches.map(async (log) => {
            const role: "buyer" | "seller" = log.buyer.toLowerCase() === address.toLowerCase() ? "buyer" : "seller";
            const { assetType, name } = await resolveAssetInfo(log.assetId);
            return {
              tokenId: Number(log.assetId),
              role,
              counterparty: role === "buyer" ? log.seller : log.buyer,
              priceEth: Number(formatEther(log.price)),
              assetType,
              name,
              blockNumber: log.blockNumber,
              txHash: log.txHash,
              source: "buyNow",
            } satisfies WalletTransaction;
          })
        );

        const transferResults = await Promise.all(
          transferMatches.map(async (log) => {
            const role: "buyer" | "seller" = log.to.toLowerCase() === address.toLowerCase() ? "buyer" : "seller";
            const { assetType, name } = await resolveAssetInfo(log.tokenId);
            return {
              tokenId: Number(log.tokenId),
              role,
              counterparty: role === "buyer" ? log.from : log.to,
              priceEth: null,
              assetType,
              name,
              blockNumber: log.blockNumber,
              txHash: log.txHash,
              source: "transfer",
            } satisfies WalletTransaction;
          })
        );

        if (!cancelled) {
          const combined = [...purchaseResults, ...transferResults];
          combined.sort((a, b) => Number(b.blockNumber - a.blockNumber));
          setTransactions(combined);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load wallet transactions.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, publicClient]);

  return { transactions, isLoading, error, progress, truncatedFromBlock };
}
