"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseEther, BaseError, ContractFunctionRevertedError } from "viem";
import { useWallet, useTrackedWrite, getWalletClient, getPublicClient } from "@/lib/walletConnect";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { ListingMediaCarousel } from "@/components/ListingMediaCarousel";
import { VerificationSeal } from "@/components/VerificationSeal";
import { OfferStatusBadge } from "@/components/OfferStatusBadge";
import { RelatedListings } from "@/components/RelatedListings";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { NetworkToggle } from "@/components/NetworkToggle";
import { MOCK_LISTINGS, MOCK_OFFERS } from "@/lib/mockListings";
import { useRealListings } from "@/lib/useRealListings";
import { useDirectTokenRead } from "@/lib/useDirectTokenRead";
import { TransferHistorySection } from "@/components/TransferHistorySection";
import { getBatchSiblingTokenIds } from "@/lib/batches";
import { CONTRACT_ADDRESSES, ACTIVE_CHAIN_ID } from "@/lib/contracts";
import { MARKETPLACE_ABI } from "@/lib/marketplaceAbi";
import { ESCROW_HOLD_ABI, HOLD_STATUS } from "@/lib/escrowHoldAbi";
import { ASSET_NFT_ABI } from "@/lib/assetNftAbi";
export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId: rawTokenId } = use(params);
  const isRealListing = rawTokenId.startsWith("real-");
  const numericTokenId = Number(isRealListing ? rawTokenId.replace("real-", "") : rawTokenId);

  const { listings: realListings, isLoading: isLoadingRealListings, refetch: refetchRealListings } =
    useRealListings();

  // A real listing can genuinely not be found yet right after minting —
  // useRealListings only surfaces tokens whose Marketplace status is
  // Active (see useRealListings.ts), so if the List transaction hasn't
  // confirmed yet, or the RPC is a step behind, refreshing immediately
  // would hard-404 something that's about to exist a few seconds later.
  // This retries a few times with a real refetch before giving up, rather
  // than trusting the first (possibly stale) read.
  const MAX_NOT_FOUND_RETRIES = 4;
  const [notFoundAttempts, setNotFoundAttempts] = useState(0);
  const realListing = isRealListing
    ? realListings.find((l) => l.tokenId === numericTokenId)
    : undefined;
  const mockListing = !isRealListing
    ? MOCK_LISTINGS.find((l) => l.tokenId === numericTokenId)
    : undefined;
  const listing = isRealListing ? realListing : mockListing;

  // Once retries are exhausted and this token still isn't an Active
  // Marketplace listing, it might still genuinely exist on-chain — just
  // sold, or minted and never listed. These read the token and its
  // transfer history directly (no dependency on Marketplace status at
  // all), so its page can show something real instead of a dead end. Only
  // enabled once retries are exhausted — no need to fire these extra reads
  // while still hoping the normal Active-listing path finds it.
  const shouldTryDirectRead = isRealListing && !listing && notFoundAttempts >= MAX_NOT_FOUND_RETRIES;
  const { info: directTokenInfo, isLoading: isDirectTokenLoading } = useDirectTokenRead(
    shouldTryDirectRead ? numericTokenId : undefined
  );

  // Every Active token ID this listing can be bought as, if it's part of a
  // multi-unit batch (see src/lib/batches.ts) — length 1 for a listing that
  // was never batched. Mock listings never have a batchId, so this is
  // always just their own tokenId for those.
  const siblingTokenIds =
    isRealListing && listing ? getBatchSiblingTokenIds(realListings, listing) : listing ? [listing.tokenId] : [];

  // Retries a real listing that isn't found yet — see the comment on
  // notFoundAttempts above for why. Does nothing for mock listings (a bad
  // mock tokenId genuinely doesn't exist, no retry will change that) or
  // once a listing is actually found.
  useEffect(() => {
    if (!isRealListing || isLoadingRealListings || listing || notFoundAttempts >= MAX_NOT_FOUND_RETRIES) {
      return;
    }
    const timer = setTimeout(() => {
      refetchRealListings().finally(() => setNotFoundAttempts((n) => n + 1));
    }, 2000);
    return () => clearTimeout(timer);
  }, [isRealListing, isLoadingRealListings, listing, notFoundAttempts, refetchRealListings]);

  const { connected: isConnected, address, chainId, switchToActiveChain } = useWallet();
  const [offerAmount, setOfferAmount] = useState("");
  const [offerDays, setOfferDays] = useState("3");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Replaces wagmi's useWriteContract/useWaitForTransactionReceipt pairs
  // — one useTrackedWrite() per independent action (offer, lock funds,
  // confirm purchase, revoke purchase), matching how wagmi's hook also
  // only tracks one in-flight write per call site. See walletConnect.ts.
  const {
    write: writeOffer,
    hash: offerTxHash,
    isPending: isOfferWritePending,
    isConfirming: isOfferConfirming,
    isSuccess: isOfferConfirmed,
    error: offerWriteError,
    reset: resetOfferWrite,
  } = useTrackedWrite();

  const [buyQuantity, setBuyQuantity] = useState(1);
  const [buyProgress, setBuyProgress] = useState<{ done: number; total: number } | null>(null);
  const [buyErrorMessage, setBuyErrorMessage] = useState<string | null>(null);
  const [lastBuyTxHash, setLastBuyTxHash] = useState<string | null>(null);
  const [buyComplete, setBuyComplete] = useState(false);

  const [holdDays, setHoldDays] = useState("2");

  const {
    write: writeLockFunds,
    hash: lockTxHash,
    isPending: isLockWritePending,
    isConfirming: isLockConfirming,
    isSuccess: isLockConfirmed,
    error: lockWriteError,
    reset: resetLockWrite,
  } = useTrackedWrite();

  // Escrow requires the SELLER to have approved the EscrowHold contract
  // specifically (separate from Marketplace's approval) — lockFunds() pulls
  // the NFT via safeTransferFrom directly, it doesn't go through Marketplace
  // at all. This is a real gap in the current /admin/mint flow, which only
  // approves Marketplace — flagging this in the UI rather than letting the
  // transaction silently revert with no explanation.
  //
  // These three reads replace wagmi's useReadContract({ query: { enabled } })
  // calls — same conditions (isRealListing && !!listing, etc.), just run as
  // a plain effect against the injected wallet provider instead.
  const [isEscrowApproved, setIsEscrowApproved] = useState<boolean | undefined>(undefined);
  const [activeHoldId, setActiveHoldId] = useState<bigint | undefined>(undefined);
  const [holdData, setHoldData] = useState<
    readonly [string, string, bigint, bigint, number, number, number] | undefined
  >(undefined);

  useEffect(() => {
    if (!isRealListing || !listing) {
      setIsEscrowApproved(undefined);
      setActiveHoldId(undefined);
      return;
    }
    const client = getPublicClient();
    if (!client) return;
    let cancelled = false;

    client
      .readContract({
        address: CONTRACT_ADDRESSES.assetNFT,
        abi: ASSET_NFT_ABI,
        functionName: "isApprovedForAll",
        args: [listing.seller as `0x${string}`, CONTRACT_ADDRESSES.escrowHold],
      })
      .then((result) => {
        if (!cancelled) setIsEscrowApproved(result as boolean);
      })
      .catch(() => {
        if (!cancelled) setIsEscrowApproved(undefined);
      });

    client
      .readContract({
        address: CONTRACT_ADDRESSES.escrowHold,
        abi: ESCROW_HOLD_ABI,
        functionName: "activeHoldByAsset",
        args: [BigInt(listing.tokenId)],
      })
      .then((result) => {
        if (!cancelled) setActiveHoldId(result as bigint);
      })
      .catch(() => {
        if (!cancelled) setActiveHoldId(undefined);
      });

    return () => {
      cancelled = true;
    };
    // isLockConfirmed/isConfirmConfirmed/isRevokeConfirmed are read below via
    // closures captured at effect-definition time in the original file, so
    // this dependency array intentionally mirrors only what actually
    // changes the query's enabled/args condition, matching wagmi's
    // { enabled } behavior rather than wagmi's automatic post-write
    // refetching (added back explicitly further down where those writes
    // resolve).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealListing, listing]);

  const hasActiveHold = !!activeHoldId && activeHoldId > 0n;

  useEffect(() => {
    if (!isRealListing || !hasActiveHold || activeHoldId === undefined) {
      setHoldData(undefined);
      return;
    }
    const client = getPublicClient();
    if (!client) return;
    let cancelled = false;
    client
      .readContract({
        address: CONTRACT_ADDRESSES.escrowHold,
        abi: ESCROW_HOLD_ABI,
        functionName: "holds",
        args: [activeHoldId],
      })
      .then((result) => {
        if (!cancelled)
          setHoldData(result as unknown as readonly [string, string, bigint, bigint, number, number, number]);
      })
      .catch(() => {
        if (!cancelled) setHoldData(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [isRealListing, hasActiveHold, activeHoldId]);

  const hold = holdData
    ? {
        seller: holdData[0],
        buyer: holdData[1],
        assetId: holdData[2],
        amount: holdData[3],
        startedAt: Number(holdData[4]),
        expiresAt: Number(holdData[5]),
        status: HOLD_STATUS[holdData[6]] ?? "None",
      }
    : null;

  const isConnectedWalletTheHoldBuyer =
    !!hold && !!address && hold.buyer.toLowerCase() === address.toLowerCase();
  const holdExpired = !!hold && Date.now() / 1000 > hold.expiresAt;

  const {
    write: writeConfirmPurchase,
    hash: confirmTxHash,
    isPending: isConfirmWritePending,
    isConfirming: isConfirmConfirming,
    isSuccess: isConfirmConfirmed,
    error: confirmWriteError,
    reset: resetConfirmWrite,
  } = useTrackedWrite();

  const {
    write: writeRevokePurchase,
    hash: revokeTxHash,
    isPending: isRevokeWritePending,
    isConfirming: isRevokeConfirming,
    isSuccess: isRevokeConfirmed,
    error: revokeWriteError,
    reset: resetRevokeWrite,
  } = useTrackedWrite();

  if (isRealListing && isLoadingRealListings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <p className="text-sm text-text-secondary">Loading on-chain listing…</p>
      </div>
    );
  }

  if (isRealListing && !listing) {
    if (notFoundAttempts < MAX_NOT_FOUND_RETRIES) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-ink">
          <p className="text-sm text-text-secondary">
            Checking for this listing on-chain… ({notFoundAttempts + 1}/{MAX_NOT_FOUND_RETRIES})
          </p>
        </div>
      );
    }

    if (isDirectTokenLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-ink">
          <p className="text-sm text-text-secondary">Not an active listing — checking the token directly…</p>
        </div>
      );
    }

    // Exists on-chain but isn't (or is no longer) an Active Marketplace
    // listing — most commonly because it already sold. Show what's real
    // about it (current owner, its images/description) plus its full
    // transfer history, instead of pretending it doesn't exist.
    if (directTokenInfo?.exists) {
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
              <Link href="/browse" className="text-xs text-text-secondary hover:text-white">
                ← Back to Browse
              </Link>

              {directTokenInfo.imageUrls.length > 0 && (
                <div className="mx-auto mt-4 max-w-xs">
                  <ListingMediaCarousel
                    assetType={directTokenInfo.assetType}
                    tokenId={directTokenInfo.tokenId}
                    imageUrls={directTokenInfo.imageUrls}
                  />
                </div>
              )}

              <span className="mt-4 inline-block rounded-sm bg-black/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-white">
                {directTokenInfo.assetType}
              </span>
              <h1 className="mt-2 font-display text-2xl italic text-white">{directTokenInfo.name}</h1>
              <p className="text-sm text-text-secondary">{directTokenInfo.location}</p>
              <p className="mt-3 text-sm text-white">{directTokenInfo.description}</p>

              <div className="mt-4 rounded-xl border border-hairline-dark bg-surface p-4">
                <p className="text-[11px] uppercase tracking-wide text-text-secondary">Current owner</p>
                <p className="mt-1 break-all font-mono text-sm text-white">{directTokenInfo.owner}</p>
                <p className="mt-3 text-xs text-text-secondary">
                  This asset isn&apos;t currently listed for sale on Marketplace — most likely it
                  already sold, or it was minted but never listed.
                </p>
              </div>

              <TransferHistorySection tokenId={directTokenInfo.tokenId} />
            </main>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink px-4 text-center">
        <p className="text-sm text-white">Can&apos;t find this listing yet.</p>
        <p className="max-w-sm text-xs text-text-secondary">
          If you just minted or listed this asset, the RPC can lag a few seconds behind a
          confirmed transaction. Try again, or head back and refresh Browse in a moment.
        </p>
        <button
          type="button"
          onClick={() => {
            setNotFoundAttempts(0);
            refetchRealListings();
          }}
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Try again
        </button>
        <Link href="/browse" className="text-xs text-text-secondary underline">
          Back to Browse
        </Link>
      </div>
    );
  }

  if (!listing) {
    notFound();
  }

  // Real listings don't have offer/related-listing history wired up yet —
  // offersByAsset() would need its own on-chain read, and "related" should
  // search the real listings set, not mock data, when viewing a real asset.
  const offers = isRealListing ? [] : (MOCK_OFFERS[listing.tokenId] ?? []);
  const activeOffers = offers.filter((o) => o.status === "Pending" || o.status === "Countered");

  const relatedSource = isRealListing ? realListings : MOCK_LISTINGS;
  const related = relatedSource.filter(
    (l) => l.tokenId !== listing.tokenId && l.assetType === listing.assetType
  ).slice(0, 4);

  const directionColor =
    listing.priceDirection === "up"
      ? "text-sage"
      : listing.priceDirection === "down"
        ? "text-clay"
        : "text-text-secondary";

  // Real on-chain call to Marketplace.sol's buyNow(assetId) on X Layer
  // testnet, once per unit requested. IMPORTANT: buyNow requires msg.value
  // to be EXACTLY equal to listing.currentPrice on-chain — not "at least",
  // not rounded. Since our mock listing prices are display-rounded floats,
  // this converts precisely via parseEther, but if the real on-chain price
  // and mock price were ever out of sync, this would revert with
  // IncorrectPaymentAmount. Same caveat as Make Offer: token IDs here are
  // mock data, so unless this exact asset has actually been listed
  // on-chain (e.g. via /admin/mint), this will revert with
  // ListingNotActive — that's expected, not a bug.
  //
  // Buying more than one unit fires one buyNow per sibling token ID,
  // sequentially — there's no batch-buy function on Marketplace, and every
  // unit is still its own independent NFT (see assetMetadata.ts's batchId
  // comment). Uses viem's walletClient/publicClient directly instead of a
  // declarative write hook, since a single hook only tracks one in-flight
  // transaction — awkward to chain N purchases through without a manual
  // queue. formatWriteError still applies to whatever it throws.
  async function handleBuyNow() {
    if (!listing) return;
    if (!isConnected || !address) {
      setActionFeedback("Connect a wallet to complete this purchase.");
      return;
    }
    if (chainId !== ACTIVE_CHAIN_ID) {
      setActionFeedback("Switch your wallet to the active network to continue.");
      switchToActiveChain();
      return;
    }

    setActionFeedback(null);
    setBuyErrorMessage(null);
    setBuyComplete(false);

    const targetTokenIds = siblingTokenIds.slice(0, buyQuantity);
    const price = parseEther(listing.currentPriceEth.toString());

    try {
      const walletClient = getWalletClient(address);
      const publicClient = getPublicClient();
      if (!walletClient || !publicClient) throw new Error("No wallet provider found.");

      for (let i = 0; i < targetTokenIds.length; i++) {
        setBuyProgress({ done: i, total: targetTokenIds.length });
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESSES.marketplace,
          abi: MARKETPLACE_ABI,
          functionName: "buyNow",
          args: [BigInt(targetTokenIds[i])],
          value: price,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        setLastBuyTxHash(hash);
      }
      setBuyProgress({ done: targetTokenIds.length, total: targetTokenIds.length });
      setBuyComplete(true);
    } catch (err) {
      setBuyErrorMessage(formatWriteError(err));
    }
  }

  // Real on-chain call to EscrowHold.sol's lockFunds(assetId, seller,
  // duration, price) — buyer pays now, NFT moves into escrow custody, buyer
  // gets an inspection window (1-7 days) before confirming or revoking.
  // Requires the SELLER to have approved EscrowHold specifically (see the
  // isEscrowApproved read above) — /admin/mint's approve step only covers
  // Marketplace, so this will revert on a freshly-minted test asset unless
  // the seller separately approves EscrowHold too.
  function handleLockFunds() {
    if (!listing) return;
    if (!isConnected || !address) {
      setActionFeedback("Connect a wallet to start a hold.");
      return;
    }
    if (chainId !== ACTIVE_CHAIN_ID) {
      setActionFeedback("Switch your wallet to the active network to continue.");
      switchToActiveChain();
      return;
    }

    resetLockWrite();
    setActionFeedback(null);

    const days = Number(holdDays) || 2;
    const durationSeconds = BigInt(days * 24 * 60 * 60);

    writeLockFunds({
      account: address,
      address: CONTRACT_ADDRESSES.escrowHold,
      abi: ESCROW_HOLD_ABI,
      functionName: "lockFunds",
      args: [BigInt(listing.tokenId), listing.seller as `0x${string}`, durationSeconds, parseEther(listing.currentPriceEth.toString())],
      value: parseEther(listing.currentPriceEth.toString()),
    });
  }

  // Real on-chain calls to EscrowHold.sol's confirmPurchase(holdId) and
  // revokePurchase(holdId). Only the buyer on the active hold can call
  // either — confirmPurchase releases funds to the seller and transfers the
  // NFT; revokePurchase refunds the buyer minus a small fee, but only works
  // before the hold's expiry (after expiry, resolveExpiredHold is the right
  // call instead — not wired up yet, flagged as a follow-up).
  function handleConfirmPurchase() {
    if (!activeHoldId || !address) return;
    resetConfirmWrite();
    setActionFeedback(null);
    writeConfirmPurchase({
      account: address,
      address: CONTRACT_ADDRESSES.escrowHold,
      abi: ESCROW_HOLD_ABI,
      functionName: "confirmPurchase",
      args: [activeHoldId],
    });
  }

  function handleRevokePurchase() {
    if (!activeHoldId || !address) return;
    resetRevokeWrite();
    setActionFeedback(null);
    writeRevokePurchase({
      account: address,
      address: CONTRACT_ADDRESSES.escrowHold,
      abi: ESCROW_HOLD_ABI,
      functionName: "revokePurchase",
      args: [activeHoldId],
    });
  }

  // Real on-chain call to Marketplace.sol's makeOffer(assetId, expiry).
  // IMPORTANT CAVEAT: the token IDs used throughout this demo (1–8) are
  // mock data — nothing has actually been listed on the real deployed
  // Marketplace contract yet (that requires AssetNFT minting + listAsset()
  // calls, which aren't built yet). So this call is REAL — it will
  // genuinely submit a transaction and cost real gas — but it will most
  // likely revert with ListingNotActive() since asset #{tokenId} doesn't
  // have an active listing on-chain. This is intentional: it's real
  // wiring, tested against a contract with no data yet, not a fake
  // simulation.
  function handleMakeOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!listing) return;
    if (!offerAmount || Number(offerAmount) <= 0) {
      setActionFeedback("Enter a valid offer amount first.");
      return;
    }
    if (!isConnected || !address) {
      setActionFeedback("Connect a wallet to submit an offer.");
      return;
    }
    if (chainId !== ACTIVE_CHAIN_ID) {
      setActionFeedback("Switch your wallet to the active network to continue.");
      switchToActiveChain();
      return;
    }

    resetOfferWrite();
    setActionFeedback(null);

    const days = Number(offerDays) || 3;
    const expiryTimestamp = BigInt(Math.floor(Date.now() / 1000) + days * 24 * 60 * 60);

    writeOffer({
      account: address,
      address: CONTRACT_ADDRESSES.marketplace,
      abi: MARKETPLACE_ABI,
      functionName: "makeOffer",
      args: [BigInt(listing.tokenId), expiryTimestamp],
      value: parseEther(offerAmount),
    });
  }

  // Surface the real revert reason where possible, instead of a generic
  // "transaction failed" — this is a hand-maintained ABI (see marketplaceAbi.ts)
  // so custom error names are decoded manually here.
  function formatWriteError(err: unknown): string {
    if (err instanceof BaseError) {
      const revertError = err.walk((e) => e instanceof ContractFunctionRevertedError);
      if (revertError instanceof ContractFunctionRevertedError) {
        const errorName = revertError.data?.errorName ?? "";
        if (errorName === "ListingNotActive") {
          return "This asset isn't actually listed on-chain yet — this demo's listings are mock data, not real Marketplace listings.";
        }
        if (errorName === "InvalidExpiry") return "Expiry must be in the future.";
        if (errorName === "InvalidPrice") return "Offer amount must be greater than zero.";
        if (errorName === "IncorrectPaymentAmount") {
          return "Payment didn't match the listed price exactly — the price may have changed on-chain since this page loaded.";
        }
        if (errorName === "NotAssetOwner") {
          return "The seller no longer owns this asset — the listing may be stale.";
        }
        if (errorName === "AssetAlreadyOnHold") {
          return "This asset already has an active hold in progress.";
        }
        if (errorName === "InvalidDuration") {
          return "Hold duration must be between 1 and 7 days.";
        }
        if (errorName === "HoldNotActive") {
          return "This hold isn't active anymore — it may have already been confirmed, revoked, or expired.";
        }
        if (errorName === "NotBuyer") {
          return "Only the buyer who started this hold can confirm or revoke it.";
        }
        if (errorName === "NotExpiredYet") {
          return "This hold's inspection window hasn't ended yet.";
        }
        return `Transaction reverted: ${errorName || "unknown reason"}.`;
      }
      return err.shortMessage || "Transaction failed.";
    }
    return "Transaction failed.";
  }

  const offerErrorMessage = offerWriteError ? formatWriteError(offerWriteError) : null;
  const lockErrorMessage = lockWriteError ? formatWriteError(lockWriteError) : null;
  const confirmErrorMessage = confirmWriteError ? formatWriteError(confirmWriteError) : null;
  const revokeErrorMessage = revokeWriteError ? formatWriteError(revokeWriteError) : null;

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

        <div className="px-4 py-3 sm:px-8">
          <Link href="/" className="text-xs text-text-secondary hover:text-white">
            ← Back to Browse
          </Link>
        </div>

        <main className="grid grid-cols-1 gap-10 px-4 pb-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left column: media + facts + description + verification */}
          <div>
            <ListingMediaCarousel assetType={listing.assetType} tokenId={listing.tokenId} imageUrls={listing.imageUrls ?? (listing.imageUrl ? [listing.imageUrl] : undefined)} />

            <div className="mt-4 grid grid-cols-3 divide-x divide-hairline-dark rounded-xl border border-hairline-dark bg-surface">
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-text-secondary">Floor Price</p>
                <p className="mt-1 font-mono text-sm font-medium text-white">
                  {listing.floorPriceEth} ETH
                </p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-text-secondary">Current (BFP)</p>
                <p className={`mt-1 font-mono text-sm font-medium ${directionColor}`}>
                  {listing.currentPriceEth} ETH
                </p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-text-secondary">
                  {siblingTokenIds.length > 1 ? "Available" : "Supply"}
                </p>
                <p className="mt-1 font-mono text-sm font-medium text-white">
                  {siblingTokenIds.length > 1 ? siblingTokenIds.length : listing.supply}
                </p>
              </div>
            </div>
            {siblingTokenIds.length > 1 ? (
              // Real, live count — every id in siblingTokenIds is a separate
              // Active NFT (see src/lib/batches.ts), so this genuinely drops
              // as units sell, unlike the old cosmetic "Supply" field below.
              <p className="mt-2 px-1 text-[10px] leading-relaxed text-text-secondary">
                {siblingTokenIds.length} identical units are listed and available right now —
                each is its own separate NFT. Choose a quantity below to buy more than one.
              </p>
            ) : (
              // Supply is a number the seller stated at mint — it's not tracked or
              // reduced on-chain. Marketplace.sol always transfers the whole NFT to
              // one buyer, regardless of what this says, so it's shown here as
              // context rather than as inventory a buyer could partially claim.
              <p className="mt-2 px-1 text-[10px] leading-relaxed text-text-secondary">
                Supply is informational, as stated by the seller — a sale transfers this
                asset in full to one buyer, it isn&apos;t split or reduced.
              </p>
            )}

            <div className="mt-8">
              <h2 className="font-display text-lg text-white">Description</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{listing.description}</p>
            </div>

            <div className="mt-8 rounded-xl border border-hairline-dark bg-surface p-5">
              <div className="flex items-center gap-3">
                <VerificationSeal size="sm" variant={listing.verifiedOrg ? "org" : "standard"} />
                <div>
                  <p className="text-sm font-medium text-white">AI-Verified Asset</p>
                  <p className="text-xs text-text-secondary">Verified {listing.verifiedDate}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-hairline-dark pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-text-secondary">Document Hash</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-white">
                    {listing.docHashFull}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-text-secondary">Verification ID</dt>
                  <dd className="mt-0.5 font-mono text-xs text-white">{listing.verificationId}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-text-secondary">Seller</dt>
                  <dd className="mt-0.5 font-mono text-xs text-white">{listing.seller}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-text-secondary">
                    {siblingTokenIds.length > 1 ? "Available" : "Supply"}
                  </dt>
                  <dd className="mt-0.5 text-xs text-white">
                    {siblingTokenIds.length > 1 ? (
                      `${siblingTokenIds.length} identical units, each a separate NFT`
                    ) : (
                      <>
                        {listing.supply} unit{listing.supply === 1 ? "" : "s"} (informational —
                        transfers as one asset)
                      </>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 border-t border-hairline-dark pt-3 text-[11px] leading-relaxed text-text-secondary">
                This document hash is stored on-chain in AssetNFT.sol. Anyone can independently
                verify the underlying deed hasn&apos;t changed since this asset was approved and
                minted.
              </p>
            </div>
          </div>

          {/* Right column: price, actions, offers */}
          <div>
            <span className="rounded-sm bg-white px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-black">
              {listing.assetType}
            </span>
            <h1 className="mt-3 font-display text-3xl leading-tight text-white">{listing.name}</h1>
            <p className="mt-1 text-sm text-text-secondary">{listing.location}</p>
            <p className="mt-1 font-mono text-xs text-text-secondary">Token #{listing.tokenId}</p>

            <div className="mt-6 rounded-xl border border-hairline-dark bg-surface p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-text-secondary">Current Price (BFP)</span>
                {listing.priceDirection !== "unchanged" && (
                  <span className={`font-mono text-xs ${directionColor}`}>
                    {listing.priceDirection === "up" ? "▲" : "▼"}{" "}
                    {Math.abs(
                      ((listing.currentPriceEth - listing.floorPriceEth) / listing.floorPriceEth) * 100
                    ).toFixed(1)}
                    % from floor
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-3xl font-medium text-white">
                {listing.currentPriceEth.toLocaleString(undefined, { maximumFractionDigits: 3 })} ETH
              </p>
              <p className="mt-0.5 font-mono text-xs text-text-secondary">
                Floor price: {listing.floorPriceEth} ETH
              </p>

              {siblingTokenIds.length > 1 && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <label className="text-xs text-text-secondary" htmlFor="buy-quantity">
                    Quantity ({siblingTokenIds.length} available)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBuyQuantity((q) => Math.max(1, q - 1))}
                      className="h-7 w-7 rounded-full border border-hairline-dark text-sm text-white hover:bg-white/10"
                    >
                      −
                    </button>
                    <input
                      id="buy-quantity"
                      type="number"
                      min={1}
                      max={siblingTokenIds.length}
                      value={buyQuantity}
                      onChange={(e) =>
                        setBuyQuantity(
                          Math.min(siblingTokenIds.length, Math.max(1, Number(e.target.value) || 1))
                        )
                      }
                      className="w-12 rounded-lg border border-hairline-dark bg-ink px-2 py-1 text-center text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setBuyQuantity((q) => Math.min(siblingTokenIds.length, q + 1))}
                      className="h-7 w-7 rounded-full border border-hairline-dark text-sm text-white hover:bg-white/10"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
              {siblingTokenIds.length > 1 && buyQuantity > 1 && (
                <p className="mt-1 font-mono text-xs text-text-secondary">
                  Total: {(listing.currentPriceEth * buyQuantity).toLocaleString(undefined, { maximumFractionDigits: 3 })} ETH
                  {" "}for {buyQuantity} units — {buyQuantity} separate purchase transactions
                </p>
              )}

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!!buyProgress && buyProgress.done < buyProgress.total}
                className="mt-5 w-full rounded-full bg-white py-3 text-sm font-medium text-black transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!buyProgress
                  ? siblingTokenIds.length > 1 && buyQuantity > 1
                    ? `Buy ${buyQuantity}`
                    : "Buy Now"
                  : buyProgress.done >= buyProgress.total
                    ? "Purchase complete"
                    : buyProgress.total > 1
                      ? `Confirming purchase ${buyProgress.done + 1} of ${buyProgress.total}…`
                      : "Confirming purchase…"}
              </button>

              {buyErrorMessage && (
                <p className="mt-3 rounded-lg bg-clay/10 border border-clay/30 px-3 py-2 text-xs text-clay">
                  {buyErrorMessage}
                </p>
              )}

              {buyComplete && lastBuyTxHash && (
                <div className="mt-3 rounded-lg bg-sage/10 border border-sage/30 px-3 py-2 text-xs text-sage">
                  Purchase complete.{" "}
                  <a
                    href={`https://www.okx.com/web3/explorer/xlayer-test/tx/${lastBuyTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View transaction
                  </a>
                </div>
              )}

              <div className="mt-3 border-t border-hairline-dark pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">
                    Hold &amp; Inspect
                  </span>
                  {isRealListing && !hasActiveHold && isEscrowApproved === false && (
                    <span className="text-[10px] text-clay">Seller hasn&apos;t approved escrow</span>
                  )}
                  {hold && (
                    <span className="text-[10px] text-text-secondary">
                      Hold status: {hold.status}
                    </span>
                  )}
                </div>

                {!hasActiveHold ? (
                  <>
                    <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                      Pay now, inspect in person, then confirm or get refunded (minus a small fee)
                      within the window.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <select
                        value={holdDays}
                        onChange={(e) => setHoldDays(e.target.value)}
                        className="rounded-full border border-hairline-dark bg-ink px-3 py-2.5 text-sm text-white outline-none"
                      >
                        <option value="1">1 day</option>
                        <option value="2">2 days</option>
                        <option value="3">3 days</option>
                        <option value="5">5 days</option>
                        <option value="7">7 days</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleLockFunds}
                        disabled={isLockWritePending || isLockConfirming}
                        className="flex-1 rounded-full border border-white/25 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLockWritePending
                          ? "Confirm in wallet…"
                          : isLockConfirming
                            ? "Locking funds…"
                            : "Start Hold"}
                      </button>
                    </div>

                    {lockErrorMessage && (
                      <p className="mt-3 rounded-lg bg-clay/10 border border-clay/30 px-3 py-2 text-xs text-clay">
                        {lockErrorMessage}
                      </p>
                    )}

                    {isLockConfirmed && lockTxHash && (
                      <div className="mt-3 rounded-lg bg-sage/10 border border-sage/30 px-3 py-2 text-xs text-sage">
                        Funds locked — asset is now in escrow, pending your inspection.{" "}
                        <a
                          href={`https://www.okx.com/web3/explorer/xlayer-test/tx/${lockTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          View transaction
                        </a>
                      </div>
                    )}
                  </>
                ) : hold?.status === "Active" ? (
                  <>
                    <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                      {holdExpired
                        ? "This hold's inspection window has passed."
                        : `Inspection window ends ${new Date(hold.expiresAt * 1000).toLocaleString()}.`}
                    </p>

                    {!isConnectedWalletTheHoldBuyer ? (
                      <p className="mt-2 text-[11px] text-text-secondary">
                        This asset is currently on hold for another buyer.
                      </p>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={handleConfirmPurchase}
                          disabled={isConfirmWritePending || isConfirmConfirming}
                          className="flex-1 rounded-full bg-white py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isConfirmWritePending
                            ? "Confirm in wallet…"
                            : isConfirmConfirming
                              ? "Finalizing…"
                              : "Confirm Purchase"}
                        </button>
                        <button
                          type="button"
                          onClick={handleRevokePurchase}
                          disabled={isRevokeWritePending || isRevokeConfirming || holdExpired}
                          className="flex-1 rounded-full border border-clay/40 py-2.5 text-sm font-medium text-clay transition-colors hover:bg-clay hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isRevokeWritePending
                            ? "Confirm in wallet…"
                            : isRevokeConfirming
                              ? "Refunding…"
                              : "Revoke & Refund"}
                        </button>
                      </div>
                    )}

                    {confirmErrorMessage && (
                      <p className="mt-3 rounded-lg bg-clay/10 border border-clay/30 px-3 py-2 text-xs text-clay">
                        {confirmErrorMessage}
                      </p>
                    )}
                    {revokeErrorMessage && (
                      <p className="mt-3 rounded-lg bg-clay/10 border border-clay/30 px-3 py-2 text-xs text-clay">
                        {revokeErrorMessage}
                      </p>
                    )}

                    {isConfirmConfirmed && confirmTxHash && (
                      <div className="mt-3 rounded-lg bg-sage/10 border border-sage/30 px-3 py-2 text-xs text-sage">
                        Purchase confirmed — funds released to seller, NFT transferred.{" "}
                        <a
                          href={`https://www.okx.com/web3/explorer/xlayer-test/tx/${confirmTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          View transaction
                        </a>
                      </div>
                    )}

                    {isRevokeConfirmed && revokeTxHash && (
                      <div className="mt-3 rounded-lg bg-sage/10 border border-sage/30 px-3 py-2 text-xs text-sage">
                        Revoked — refunded minus the inspection fee.{" "}
                        <a
                          href={`https://www.okx.com/web3/explorer/xlayer-test/tx/${revokeTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          View transaction
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-[11px] text-text-secondary">
                    This hold has already been {hold?.status.toLowerCase()}.
                  </p>
                )}
              </div>

              <form onSubmit={handleMakeOffer} className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    placeholder="Offer amount (ETH)"
                    className="flex-1 rounded-full border border-hairline-dark bg-ink px-4 py-2.5 text-sm text-white outline-none placeholder:text-text-secondary focus:border-white/50"
                  />
                  <select
                    value={offerDays}
                    onChange={(e) => setOfferDays(e.target.value)}
                    className="rounded-full border border-hairline-dark bg-ink px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="1">Expires in 1 day</option>
                    <option value="3">Expires in 3 days</option>
                    <option value="7">Expires in 7 days</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isOfferWritePending || isOfferConfirming}
                  className="w-full rounded-full border border-white/25 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isOfferWritePending
                    ? "Confirm in wallet…"
                    : isOfferConfirming
                      ? "Submitting offer…"
                      : "Make Offer"}
                </button>
              </form>

              {actionFeedback && (
                <p className="mt-3 rounded-lg bg-ink px-3 py-2 text-xs text-text-secondary">
                  {actionFeedback}
                </p>
              )}

              {offerErrorMessage && (
                <p className="mt-3 rounded-lg bg-clay/10 border border-clay/30 px-3 py-2 text-xs text-clay">
                  {offerErrorMessage}
                </p>
              )}

              {isOfferConfirmed && offerTxHash && (
                <div className="mt-3 rounded-lg bg-sage/10 border border-sage/30 px-3 py-2 text-xs text-sage">
                  Offer submitted on-chain.{" "}
                  <a
                    href={`https://www.okx.com/web3/explorer/xlayer-test/tx/${offerTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View transaction
                  </a>
                </div>
              )}
            </div>

            <div className="mt-6">
              <h2 className="font-display text-lg text-white">
                Offers {activeOffers.length > 0 && `(${activeOffers.length} active)`}
              </h2>

              {offers.length === 0 ? (
                <p className="mt-3 text-sm text-text-secondary">No offers yet on this asset.</p>
              ) : (
                <div className="mt-3 divide-y divide-hairline-dark rounded-xl border border-hairline-dark bg-surface">
                  {offers.map((offer) => (
                    <div key={offer.offerId} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-white">{offer.buyer}</p>
                        <p className="mt-0.5 text-[11px] text-text-secondary">
                          Expires {offer.expiresAt}
                          {offer.isSellerCounter && " · countered by seller"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-mono text-sm text-white">{offer.amountEth} ETH</span>
                        <OfferStatusBadge status={offer.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isRealListing && <TransferHistorySection tokenId={listing.tokenId} />}
            </div>
          </div>
        </main>

        <div className="px-4 pb-16 sm:px-8">
          <RelatedListings listings={related} hrefPrefix={isRealListing ? "real-" : ""} />
        </div>
      </div>
    </div>
  );
}
