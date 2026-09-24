"use client";

import { useTokenTransferHistory } from "@/lib/useTokenTransferHistory";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface TransferHistorySectionProps {
  tokenId: number;
}

/**
 * Full on-chain transfer history for one token — MINTED TO / TRANSFERRED
 * FROM ... TO ..., full addresses (not truncated, per an explicit request
 * — this is meant to be verifiable, not just decorative). Shown on every
 * real token's page, active listing or not, since a token's history is
 * true regardless of whether it's currently for sale.
 */
export function TransferHistorySection({ tokenId }: TransferHistorySectionProps) {
  const { transfers, isLoading, progress, truncatedFromBlock } = useTokenTransferHistory(tokenId);

  return (
    <div className="mt-6 rounded-xl border border-hairline-dark">
      <h2 className="border-b border-hairline-dark px-4 py-3 text-sm font-medium text-white">
        Transfer history
      </h2>
      {truncatedFromBlock !== null && (
        <p className="border-b border-hairline-dark px-4 py-2 text-[11px] text-seal-gold-soft">
          This chain has a long history and there&apos;s no indexer yet, so this only covers
          activity from block {truncatedFromBlock.toString()} onward — a mint or transfer before
          that block wouldn&apos;t show here even though it really happened.
        </p>
      )}
      {isLoading ? (
        <p className="px-4 py-4 text-sm text-text-secondary">
          {progress
            ? `Scanning — ${progress.done}/${progress.total} block ranges checked…`
            : "Reading transfer history…"}
        </p>
      ) : transfers.length === 0 ? (
        <p className="px-4 py-4 text-sm text-text-secondary">No transfers found.</p>
      ) : (
        transfers.map((t, i) => {
          const isMint = t.from.toLowerCase() === ZERO_ADDRESS;
          return (
            <div key={`${t.txHash}-${i}`} className="border-b border-hairline-dark px-4 py-3 last:border-b-0">
              <p className="break-all font-mono text-xs text-white">
                {isMint ? <>MINTED TO {t.to}</> : <>TRANSFERRED FROM {t.from} TO {t.to}</>}
              </p>
              <a
                href={`https://www.okx.com/web3/explorer/xlayer-test/tx/${t.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block font-mono text-[10px] text-text-secondary underline decoration-hairline-dark hover:text-white"
              >
                View tx
              </a>
            </div>
          );
        })
      )}
    </div>
  );
}
