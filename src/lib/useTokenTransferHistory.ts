"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { CONTRACT_ADDRESSES } from "./contracts";
import { ASSET_NFT_ABI } from "./assetNftAbi";
import { getPublicClient } from "./walletConnect";
import { scanLogsInChunks, type ChainPublicClient, type ScanProgress } from "./chainScan";

export interface TokenTransfer {
  from: Address;
  to: Address;
  blockNumber: bigint;
  txHash: `0x${string}`;
}

export type { ScanProgress };

const TRANSFER_EVENT = ASSET_NFT_ABI.find((item) => item.type === "event" && item.name === "Transfer");

// Cached per tokenId at module scope — same reasoning as
// useWalletTransactions.ts: this token's transfer history doesn't change
// on every render, and is the same for every visitor to this token's
// page, so re-viewing it in the same session shouldn't re-scan the chain.
const cache = new Map<number, ReturnType<typeof scanToken>>();

function scanToken(client: ChainPublicClient, tokenId: number, onProgress: (p: ScanProgress) => void) {
  if (!TRANSFER_EVENT) {
    throw new Error("Transfer event not found in ASSET_NFT_ABI — ABI may be out of date.");
  }
  return scanLogsInChunks(
    client,
    CONTRACT_ADDRESSES.assetNFT,
    TRANSFER_EVENT,
    { tokenId: BigInt(tokenId) },
    onProgress,
    (log) => {
      const args = log.args as { from: Address; to: Address; tokenId: bigint };
      return {
        from: args.from,
        to: args.to,
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? "0x0",
      } satisfies TokenTransfer;
    }
  );
}

/**
 * Full transfer history for one specific token — every ERC-721 Transfer
 * event where this tokenId is the indexed argument, from mint (from the
 * zero address) through every sale or direct transfer since. This is what
 * powers the "Transferred FROM ... TO ..." section on a token's page,
 * including for tokens that are no longer an Active Marketplace listing
 * (sold, or never listed at all) — see useRealListings.ts for why those
 * don't show up there.
 *
 * Filtering by tokenId (indexed) narrows what each chunk returns, but
 * doesn't reduce how many chunks are needed — the RPC's 100-block cap
 * applies to the range regardless of filter specificity. If the real
 * history is too long to fully scan (see chainScan.ts — confirmed via a
 * real scan attempt needing 21,000+ requests), this only covers the most
 * recent window and `truncatedFromBlock` reports the actual cutoff, so a
 * token minted before that block would show no history here even though
 * it really was minted — this is a real limitation, not a bug, given no
 * indexer exists yet.
 */
export function useTokenTransferHistory(tokenId: number | undefined) {
  // See useWalletTransactions.ts for why this is called directly rather
  // than through a wagmi hook.
  const publicClient = getPublicClient();
  const [transfers, setTransfers] = useState<TokenTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [truncatedFromBlock, setTruncatedFromBlock] = useState<bigint | null>(null);

  useEffect(() => {
    if (tokenId === undefined || !publicClient) {
      setTransfers([]);
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
        let promise = cache.get(tokenId);
        if (!promise) {
          promise = scanToken(client, tokenId, (p) => {
            if (!cancelled) setProgress(p);
          }).catch((err) => {
            cache.delete(tokenId); // allow retry on the next view instead of caching a failure forever
            throw err;
          });
          cache.set(tokenId, promise);
        }

        const result = await promise;
        if (!cancelled) {
          // Chronological — oldest (the mint) first, most recent last.
          setTransfers([...result.logs].sort((a, b) => Number(a.blockNumber - b.blockNumber)));
          setTruncatedFromBlock(result.truncated ? result.scannedFromBlock : null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load transfer history.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenId, publicClient]);

  return { transfers, isLoading, error, progress, truncatedFromBlock };
}
