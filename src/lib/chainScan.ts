"use client";

import type { Address, PublicClient } from "viem";
import { CONTRACT_ADDRESSES } from "./contracts";

export interface ScanProgress {
  done: number;
  total: number;
}

export interface ScanResult<T> {
  logs: T[];
  // True if the real history is longer than what got scanned — the chain
  // has run for ~2.1M blocks since deployment (confirmed via a real scan
  // attempt), which would mean 21,000+ chunked requests at the RPC's
  // 100-block-per-call cap — far too slow for a page load. Rather than
  // failing outright (the original behavior), this scans the most recent
  // PRACTICAL_CHUNK_LIMIT chunks and reports the cutoff honestly instead
  // of silently claiming to show "full" history that it didn't actually
  // cover.
  truncated: boolean;
  scannedFromBlock: bigint;
}

// Was NonNullable<ReturnType<typeof usePublicClient>> (a wagmi-derived
// type) — now viem's own PublicClient directly, since walletConnect.ts's
// getPublicClient() builds one without going through wagmi at all.
export type ChainPublicClient = PublicClient;

// Confirmed from a real run against the deployed RPC (testrpc.xlayer.tech):
// eth_getLogs rejects any fromBlock/toBlock span over 100 blocks with
// "Invalid parameters... block range greater than 100 max".
const MAX_BLOCK_RANGE = 100n;

// The real, practical ceiling on how far back a scan goes — see
// ScanResult.truncated's comment for why. 1,500 chunks = 150k blocks,
// which even at this chain's roughly 1-2s block time still covers several
// days of activity — in practice, almost certainly everything from this
// project's actual testing window. Not a "safety valve" anymore (the
// original version threw past 5,000) — this is now the real, expected
// operating limit, hit on essentially every fresh wallet/token lookup
// against real deployment history.
const PRACTICAL_CHUNK_LIMIT = 1500;

// How many 100-block chunks to request in parallel per batch. Lowered from
// an earlier 15 after reasoning through a real robustness gap: with no
// retry, a single failed request in a batch of 15 (this RPC has shown real
// flakiness — the 100-block cap itself, and a separate 429 seen on an IPFS
// gateway) would abort the entire scan via Promise.all. Combined with the
// retry below, a lower number here means less concurrent load in the first
// place, on top of tolerating individual failures.
const CONCURRENCY = 8;

// Retries a single chunk request before giving up on it — a transient RPC
// hiccup on 1 of ~8 concurrent requests shouldn't fail an entire scan
// that's otherwise almost done. Exponential-ish backoff (300ms, 900ms) to
// give a rate limit a moment to clear rather than hammering it again
// immediately.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300 * 3 ** i));
      }
    }
  }
  throw lastError;
}

// Cached at module scope — the deployment block never changes, and is the
// same regardless of which hook or address is asking, so every caller
// across the app (wallet history, per-token history) shares one discovery
// instead of each re-running the binary search independently.
let deploymentBlockPromise: Promise<bigint> | null = null;

/**
 * Finds the block AssetNFT's contract code first appears at, via binary
 * search over eth_getCode rather than guessing or hardcoding a number that
 * would go stale the next time this project redeploys. ~20 requests for a
 * chain with a few million blocks, since it's log2(range).
 *
 * If eth_getCode at a historical block isn't supported by this RPC (a
 * non-archive node can throw "missing trie node" / "state not available"
 * for anything but recent blocks), this throws rather than falling back to
 * block 0 — scanning from genesis on a chain that's been running since
 * 2024 would mean tens of thousands of chunks for blocks that predate this
 * contract entirely.
 */
async function findDeploymentBlock(client: ChainPublicClient): Promise<bigint> {
  const currentBlock = await client.getBlockNumber();
  let lo = 0n;
  let hi = currentBlock;

  const codeAt = async (block: bigint) => {
    const code = await withRetry(() =>
      client.getCode({ address: CONTRACT_ADDRESSES.assetNFT, blockNumber: block })
    );
    return !!code && code !== "0x";
  };

  if (!(await codeAt(hi))) {
    throw new Error("AssetNFT has no code at the latest block — check CONTRACT_ADDRESSES.assetNFT.");
  }

  while (lo < hi) {
    const mid = lo + (hi - lo) / 2n;
    if (await codeAt(mid)) {
      hi = mid;
    } else {
      lo = mid + 1n;
    }
  }
  return hi;
}

function buildChunks(fromBlock: bigint, toBlock: bigint): [bigint, bigint][] {
  const chunks: [bigint, bigint][] = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = start + MAX_BLOCK_RANGE - 1n > toBlock ? toBlock : start + MAX_BLOCK_RANGE - 1n;
    chunks.push([start, end]);
    start = end + 1n;
  }
  return chunks;
}

/**
 * Scans a contract's logs for one event type, chunked into ≤100-block
 * windows (the RPC's hard limit), run CONCURRENCY at a time. `args`
 * narrows by indexed parameter (e.g. a specific tokenId) — this reduces
 * how much gets returned per chunk, but does NOT reduce the number of
 * chunks needed, since the 100-block cap applies to the range regardless
 * of how specific the filter is.
 *
 * If the real range (deployment block to now) needs more than
 * PRACTICAL_CHUNK_LIMIT chunks, this scans only the most recent
 * PRACTICAL_CHUNK_LIMIT worth of blocks (working backward from "now") and
 * reports `truncated: true` — see ScanResult's comment. Older activity
 * beyond `scannedFromBlock` isn't included, and callers should say so
 * rather than imply a complete history.
 */
export async function scanLogsInChunks<T>(
  client: ChainPublicClient,
  address: Address,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
  onProgress: (p: ScanProgress) => void,
  // Same reasoning as event/args above: viem's getLogs overload resolution
  // picks the generic Log signature (no `args`) when event/args are `any`,
  // so decode's log param is typed loosely too rather than fighting viem's
  // overloads — callers cast log.args to the shape they know it has.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decode: (log: any) => T
): Promise<ScanResult<T>> {
  const deploymentBlock = await (deploymentBlockPromise ??= findDeploymentBlock(client));
  const currentBlock = await client.getBlockNumber();
  let chunks = buildChunks(deploymentBlock, currentBlock);

  const truncated = chunks.length > PRACTICAL_CHUNK_LIMIT;
  if (truncated) {
    // Keep the most recent PRACTICAL_CHUNK_LIMIT chunks (the tail of the
    // array, since buildChunks runs oldest-to-newest) — recent activity
    // matters far more than the earliest history for both wallet lookups
    // and a token's page.
    chunks = chunks.slice(chunks.length - PRACTICAL_CHUNK_LIMIT);
  }
  const scannedFromBlock = chunks[0]?.[0] ?? currentBlock;

  const decoded: T[] = [];
  let done = 0;

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(([fromBlock, toBlock]) =>
        withRetry(() => client.getLogs({ address, event, args, fromBlock, toBlock }))
      )
    );
    for (const logs of batchResults) {
      for (const log of logs) {
        decoded.push(decode(log));
      }
    }
    done += batch.length;
    onProgress({ done, total: chunks.length });
  }

  return { logs: decoded, truncated, scannedFromBlock };
}
