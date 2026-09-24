"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/walletConnect";
import { isAddress, type Address } from "viem";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { NetworkToggle } from "@/components/NetworkToggle";
import { useWalletTransactions, type WalletTransaction } from "@/lib/useWalletTransactions";

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isBuy = tx.role === "buyer";
  const isTransfer = tx.source === "transfer";
  return (
    <Link
      href={`/listing/real-${tx.tokenId}`}
      className="flex items-center justify-between gap-4 border-b border-hairline-dark px-4 py-4 transition-colors last:border-b-0 hover:bg-surface sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${
            isTransfer ? "bg-white/10 text-white" : isBuy ? "bg-sage text-white" : "bg-seal-gold-soft text-ink"
          }`}
        >
          {isTransfer ? "Transferred" : isBuy ? "Bought" : "Sold"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-white">
            {tx.name} · {tx.assetType} #{tx.tokenId}
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-text-secondary">
            {isBuy ? "From: " : "To: "}
            {tx.counterparty.slice(0, 6)}…{tx.counterparty.slice(-4)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-mono text-sm text-white">
          {tx.priceEth === null ? "Price not on-chain" : `${tx.priceEth} ETH`}
        </span>
        <a
          href={`https://www.okx.com/web3/explorer/xlayer-test/tx/${tx.txHash}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[10px] text-text-secondary underline decoration-hairline-dark hover:text-white"
        >
          View tx
        </a>
      </div>
    </Link>
  );
}

export default function WalletPage() {
  const { address: connectedAddress, connected: isConnected } = useWallet();
  const [inputValue, setInputValue] = useState("");
  const [searchedAddress, setSearchedAddress] = useState<Address | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { transactions, isLoading, error, progress, truncatedFromBlock } = useWalletTransactions(
    searchedAddress ?? undefined
  );

  function handleSearch(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setFormError("Enter an address.");
      return;
    }
    if (!isAddress(trimmed)) {
      setFormError("That doesn't look like a valid address.");
      return;
    }
    setFormError(null);
    setSearchedAddress(trimmed as Address);
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

        <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
          <h1 className="font-display text-2xl italic text-white">Wallet</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Paste any address to see its real, on-chain buy/sell history — every row here comes
            directly from an <code className="text-white">AssetPurchased</code> event on
            Marketplace.sol, not from anything PropChain asserts off-chain. This shows completed
            sales only, not open offers or current listings.
          </p>

          <div className="mt-6 flex gap-2">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(inputValue)}
              placeholder="0x…"
              className="w-full rounded-lg border border-hairline-dark bg-ink-raised px-3 py-2 font-mono text-sm text-white outline-none"
            />
            <button
              type="button"
              onClick={() => handleSearch(inputValue)}
              className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-85"
            >
              View
            </button>
          </div>

          {isConnected && connectedAddress && (
            <button
              type="button"
              onClick={() => {
                setInputValue(connectedAddress);
                handleSearch(connectedAddress);
              }}
              className="mt-2 text-xs text-text-secondary underline decoration-hairline-dark hover:text-white"
            >
              Use my connected wallet
            </button>
          )}

          {formError && <p className="mt-2 text-xs text-clay">{formError}</p>}

          <div className="mt-8">
            {!searchedAddress ? (
              <p className="text-sm text-text-secondary">
                Enter an address above to see its transaction history.
              </p>
            ) : isLoading ? (
              <div className="text-sm text-text-secondary">
                <p>
                  {progress
                    ? `Scanning on-chain history — ${progress.done}/${progress.total} block ranges checked…`
                    : "Reading on-chain history…"}
                </p>
                <p className="mt-1 text-xs">
                  The RPC only allows 100 blocks per request, so a full scan is chunked into many
                  requests — this can take a while the first time. Later lookups in this session
                  reuse the same scan and are instant.
                </p>
              </div>
            ) : error ? (
              <p className="rounded-lg bg-clay/10 border border-clay/30 px-3 py-2 text-xs text-clay">
                {error}
              </p>
            ) : (
              <>
                {truncatedFromBlock !== null && (
                  <p className="mb-3 text-[11px] text-seal-gold-soft">
                    This chain has a long history and there&apos;s no indexer yet, so this only
                    covers activity from block {truncatedFromBlock.toString()} onward — not
                    necessarily this address&apos;s full history.
                  </p>
                )}
                {transactions.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    No completed buy/sell transactions found for this address
                    {truncatedFromBlock !== null ? " in the scanned range" : ""}.
                  </p>
                ) : (
                  <div className="rounded-xl border border-hairline-dark">
                    {transactions.map((tx) => (
                      <TransactionRow key={`${tx.txHash}-${tx.role}`} tx={tx} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <p className="mt-8 text-[11px] leading-relaxed text-text-secondary">
            "Bought"/"Sold" rows come from a confirmed Buy Now purchase, with a real price.
            "Transferred" rows are any other NFT movement between these two addresses — most
            likely an accepted offer, but a raw on-chain transfer carries no price, so it can&apos;t
            be labeled more specifically than that; no price is shown for these. Live/pending
            offers for your own wallet are on your{" "}
            <Link href="/profile" className="underline decoration-hairline-dark hover:text-white">
              Profile
            </Link>{" "}
            page instead.
          </p>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
