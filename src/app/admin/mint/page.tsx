"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keccak256, toBytes, parseEther, BaseError, ContractFunctionRevertedError } from "viem";
import { useWallet, getWalletClient, getPublicClient } from "@/lib/walletConnect";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { NetworkToggle } from "@/components/NetworkToggle";
import { CONTRACT_ADDRESSES, ACTIVE_CHAIN_ID } from "@/lib/contracts";
import { ASSET_NFT_ABI, ASSET_TYPE_ENUM, ASSET_MINTED_EVENT_SIGNATURE } from "@/lib/assetNftAbi";
import { MARKETPLACE_ABI } from "@/lib/marketplaceAbi";
import { encodeMetadataDataUri } from "@/lib/assetMetadata";

/**
 * Internal-only page — NOT linked from the sidebar or any nav. Originally
 * built as a testing shortcut (skipping straight to the verifier-gated
 * mint call, since the only verifier is the deployer wallet — see
 * scripts/deploy.js), now repurposed as the mint path for organizations or
 * agents the operator has personally confirmed the identity of. Sets
 * verifiedOrg: true in the minted metadata (see assetMetadata.ts), which
 * VerificationSeal renders as a blue seal instead of the standard gray one
 * every /list seller gets after AI-only document verification.
 */
export default function AdminMintPage() {
  const { address, connected: isConnected, chainId, switchToActiveChain } = useWallet();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("Test Asset — Admin Mint");
  const [assetType, setAssetType] = useState<(typeof ASSET_TYPE_ENUM)[number]>("House");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [supply, setSupply] = useState("1");
  const MAX_IMAGES = 5;
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [floorPrice, setFloorPrice] = useState("0.01");
  // One entry per physical unit minted — same real multi-unit support as
  // /list's handleMint. A quantity of 1 still gets a one-element array so
  // the rest of the flow doesn't need a separate single-vs-batch path.
  const [mintedTokenIds, setMintedTokenIds] = useState<bigint[]>([]);
  const [mintProgress, setMintProgress] = useState<{ done: number; total: number } | null>(null);
  const [listProgress, setListProgress] = useState<{
    phase: "approving" | "listing";
    done: number;
    total: number;
  } | null>(null);
  const [listingError, setListingError] = useState<string | null>(null);

  const [mintingError, setMintingError] = useState<string | null>(null);

  // Replaces wagmi's useWriteContract/useWaitForTransactionReceipt for the
  // Step 3 "Approve Escrow" button — a single in-flight write, tracked
  // manually the same way the sequential mint/list loops below already
  // have to be (see handleApproveAndListAll's comment on why this file
  // doesn't use a declarative write hook at all anymore).
  const [isApproveEscrowPending, setIsApproveEscrowPending] = useState(false);
  const [isApproveEscrowConfirming, setIsApproveEscrowConfirming] = useState(false);
  const [isApproveEscrowConfirmed, setIsApproveEscrowConfirmed] = useState(false);
  const [approveEscrowError, setApproveEscrowError] = useState<unknown>(null);
  const [isEscrowApproved, setIsEscrowApproved] = useState<boolean | undefined>(undefined);

  // Refreshes the isApprovedForAll read whenever step 3 becomes active or
  // right after a successful approval — replaces wagmi's
  // useReadContract({ query: { enabled } }) reactivity.
  useEffect(() => {
    if (!address || step !== 3) return;
    const client = getPublicClient();
    if (!client) return;
    let cancelled = false;
    client
      .readContract({
        address: CONTRACT_ADDRESSES.assetNFT,
        abi: ASSET_NFT_ABI,
        functionName: "isApprovedForAll",
        args: [address, CONTRACT_ADDRESSES.escrowHold],
      })
      .then((result) => {
        if (!cancelled) setIsEscrowApproved(result as boolean);
      })
      .catch(() => {
        if (!cancelled) setIsEscrowApproved(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [address, step, isApproveEscrowConfirmed]);

  function formatError(err: unknown): string {
    if (err instanceof BaseError) {
      const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
      if (revert instanceof ContractFunctionRevertedError) {
        return `Reverted: ${revert.data?.errorName ?? "unknown reason"}`;
      }
      return err.shortMessage || "Transaction failed.";
    }
    return "Transaction failed.";
  }

  function ensureRightChain(): boolean {
    if (chainId !== ACTIVE_CHAIN_ID) {
      switchToActiveChain();
      return false;
    }
    return true;
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setImageUploadError(null);

    const remainingSlots = MAX_IMAGES - imagePreviews.length;
    if (remainingSlots <= 0) {
      setImageUploadError(`You can upload up to ${MAX_IMAGES} photos.`);
      return;
    }
    const filesToAdd = files.slice(0, remainingSlots);

    filesToAdd.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setImagePreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(f);
    });
  }

  function removeImageAt(index: number) {
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadImagesIfPresent(): Promise<string[]> {
    if (imagePreviews.length === 0) return [];
    setIsUploadingImage(true);
    setImageUploadError(null);
    const urls: string[] = [];
    try {
      // Uploaded sequentially, not in parallel — Pinata's free tier
      // likely has rate limits, and sequential is simpler to reason about
      // for error reporting (which specific photo failed).
      for (const preview of imagePreviews) {
        const res = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: preview }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Image upload failed.");
        urls.push(data.url as string);
      }
      return urls;
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : "Image upload failed.");
      return urls; // return whatever succeeded before the failure, rather than discarding it
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleMint() {
    if (!address || !ensureRightChain()) return;
    setMintingError(null);
    setMintProgress(null);

    const quantity = Math.max(1, Number(supply) || 1);
    const typeIndex = ASSET_TYPE_ENUM.indexOf(assetType);

    // Upload the photo to IPFS first (if one was selected) — only its URL
    // goes into the on-chain metadata, not the raw image bytes. See
    // /api/upload-image/route.ts. If this fails, minting still proceeds
    // without an image rather than blocking the whole flow — a failed
    // photo upload shouldn't stop someone from listing their asset. Every
    // unit in this batch is identical, so this happens once and the same
    // URLs get reused for each mint call below.
    const imageUrls = await uploadImagesIfPresent();

    // Real multi-unit support, same as /list's handleMint: instead of one
    // token whose metadata.supply says "N" (cosmetic only — Marketplace has
    // no partial-sale logic and never did), this mints `quantity` separate
    // tokens, each a genuinely independent NFT representing one physical
    // unit, sharing a batchId so the frontend can group them and count how
    // many are still Active. A quantity of 1 skips batchId entirely.
    const batchId = quantity > 1 ? crypto.randomUUID() : undefined;

    const metadataURI = encodeMetadataDataUri({
      name,
      description: description || "No description provided.",
      location: location || "Not specified",
      assetType,
      imageUrls,
      batchId,
      // /admin/mint is where the operator personally confirms a seller's
      // identity before minting on their behalf — that's the whole reason
      // this field is true here and nowhere else.
      verifiedOrg: true,
      attributes: [
        { trait_type: "Asset Type", value: assetType },
        { trait_type: "Location", value: location || "Not specified" },
      ],
    });

    try {
      const walletClient = getWalletClient(address);
      const publicClient = getPublicClient();
      if (!walletClient || !publicClient) throw new Error("No wallet provider found.");

      const newTokenIds: bigint[] = [];
      for (let i = 0; i < quantity; i++) {
        setMintProgress({ done: i, total: quantity });
        // Unique per unit so repeated testing doesn't collide with
        // AssetNFT's permanent docHash-reuse block (see flagged open
        // items — that block has no expiry, so re-minting with the same
        // hash will revert).
        const docHash = keccak256(toBytes(`${name}-${Date.now()}-${i}`));
        const verificationId = keccak256(toBytes(`admin-test-verification-${Date.now()}-${i}`));

        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESSES.assetNFT,
          abi: ASSET_NFT_ABI,
          functionName: "mintAsset",
          args: [address, typeIndex, BigInt(1), docHash, verificationId, metadataURI],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Pull the minted tokenId from the AssetMinted event log. Must
        // match on the event SIGNATURE (topics[0]), not just the contract
        // address — AssetNFT also emits the standard ERC721 Transfer event
        // at the same address on every mint, and grabbing that one instead
        // reads its "from" address (0x000...0) as if it were the token ID.
        // See the comment on ASSET_MINTED_EVENT_SIGNATURE in
        // assetNftAbi.ts for the full story — this was a real bug that
        // caused failed listing transactions.
        const mintedLog = receipt.logs.find(
          (log) =>
            log.address.toLowerCase() === CONTRACT_ADDRESSES.assetNFT.toLowerCase() &&
            log.topics[0]?.toLowerCase() === ASSET_MINTED_EVENT_SIGNATURE.toLowerCase()
        );
        if (!mintedLog || !mintedLog.topics[1]) {
          throw new Error(`Could not read minted token ID from unit ${i + 1} of ${quantity}.`);
        }
        newTokenIds.push(BigInt(mintedLog.topics[1]));
      }
      setMintProgress({ done: quantity, total: quantity });
      setMintedTokenIds(newTokenIds);
      setStep(2);
    } catch (err) {
      setMintingError(err instanceof Error ? err.message : "Mint failed.");
    }
  }

  // Approves once (blanket setApprovalForAll — unaffected by quantity) then
  // lists every minted unit sequentially. Uses viem's walletClient/
  // publicClient directly instead of a declarative write hook, since a
  // single hook only tracks one in-flight transaction at a time — awkward
  // to chain N sequential list calls through without a manual queue. This
  // mirrors the exact sequencing the old wagmi/actions calls did, just
  // issued through the injected wallet provider (see walletConnect.ts)
  // instead of wagmi's config object. formatError() still applies to
  // whatever it throws, since viem's BaseError/ContractFunctionRevertedError
  // types are unchanged.
  async function handleApproveAndListAll() {
    if (!ensureRightChain() || mintedTokenIds.length === 0 || !address) return;
    setListingError(null);

    try {
      const walletClient = getWalletClient(address);
      const publicClient = getPublicClient();
      if (!walletClient || !publicClient) throw new Error("No wallet provider found.");

      setListProgress({ phase: "approving", done: 0, total: 1 });
      const alreadyApproved = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.assetNFT,
        abi: ASSET_NFT_ABI,
        functionName: "isApprovedForAll",
        args: [address, CONTRACT_ADDRESSES.marketplace],
      });
      if (!alreadyApproved) {
        const approveHash = await walletClient.writeContract({
          address: CONTRACT_ADDRESSES.assetNFT,
          abi: ASSET_NFT_ABI,
          functionName: "setApprovalForAll",
          args: [CONTRACT_ADDRESSES.marketplace, true],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
      setListProgress({ phase: "approving", done: 1, total: 1 });

      const price = parseEther(floorPrice);
      for (let i = 0; i < mintedTokenIds.length; i++) {
        setListProgress({ phase: "listing", done: i, total: mintedTokenIds.length });
        const listHash = await walletClient.writeContract({
          address: CONTRACT_ADDRESSES.marketplace,
          abi: MARKETPLACE_ABI,
          functionName: "listAsset",
          args: [mintedTokenIds[i], price],
        });
        await publicClient.waitForTransactionReceipt({ hash: listHash });
      }
      setListProgress({ phase: "listing", done: mintedTokenIds.length, total: mintedTokenIds.length });
      setStep(3);
    } catch (err) {
      setListingError(formatError(err));
    }
  }

  // Replaces wagmi's declarative useWriteContract/useWaitForTransactionReceipt
  // for this one button — tracked with plain state since there's only ever
  // one in-flight write here.
  async function handleApproveEscrow() {
    if (!ensureRightChain() || !address) return;
    setApproveEscrowError(null);
    setIsApproveEscrowConfirmed(false);
    setIsApproveEscrowPending(true);
    try {
      const walletClient = getWalletClient(address);
      const publicClient = getPublicClient();
      if (!walletClient || !publicClient) throw new Error("No wallet provider found.");

      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.assetNFT,
        abi: ASSET_NFT_ABI,
        functionName: "setApprovalForAll",
        args: [CONTRACT_ADDRESSES.escrowHold, true],
      });
      setIsApproveEscrowPending(false);
      setIsApproveEscrowConfirming(true);
      await publicClient.waitForTransactionReceipt({ hash });
      setIsApproveEscrowConfirming(false);
      setIsApproveEscrowConfirmed(true);
    } catch (err) {
      setIsApproveEscrowPending(false);
      setIsApproveEscrowConfirming(false);
      setApproveEscrowError(err);
    }
  }
  return (
    <div className="min-h-screen bg-ink">
      <header className="flex items-center justify-between border-b border-hairline-dark bg-ink px-4 py-4 sm:px-8">
        <Link href="/" className="font-display text-xl italic text-white">
          PropChain <span className="font-mono text-xs text-text-secondary">/ admin / mint</span>
        </Link>
        <div className="flex items-center gap-2">
          <NetworkToggle />
          <ConnectWalletButton />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-12 sm:px-8">
        <h1 className="font-display text-2xl text-white">Mint for a verified organization</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Internal-only page — for organizations or agents you&apos;ve personally confirmed the
          identity of. Assets minted here carry a blue verification seal instead of the standard
          gray one /list gives every AI-verified seller. Mints an NFT on the deployed AssetNFT
          contract, approves the Marketplace to transfer it, and lists it for sale — three real
          transactions on X Layer testnet. Your connected wallet must be the contract&apos;s
          verifier (the deployer wallet is, by default).
        </p>

        {!isConnected && (
          <p className="mt-6 rounded-lg bg-surface px-4 py-3 text-sm text-text-secondary">
            Connect your wallet to continue.
          </p>
        )}

        {isConnected && (
          <div className="mt-8 space-y-6">
            {/* Step 1: Mint */}
            <div
              className={`rounded-xl border p-5 ${step === 1 ? "border-white" : "border-hairline-dark opacity-60"}`}
            >
              <h2 className="text-sm font-medium text-white">Step 1 — Mint</h2>
              {step === 1 ? (
                <div className="mt-3 space-y-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Asset name (for your reference only)"
                    className="w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                  />
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value as typeof assetType)}
                    className="w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                  >
                    {ASSET_TYPE_ENUM.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Location (e.g. Lekki, Lagos)"
                    className="w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                  />
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-text-secondary">
                      How many identical units?
                    </label>
                    <p className="mt-0.5 text-[11px] text-text-secondary">
                      For 2+, each unit mints and lists as its own separate NFT — a buyer can
                      purchase any number of them. Use this only for genuinely identical
                      physical units, not shared ownership of one item.
                    </p>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={supply}
                      onChange={(e) => setSupply(e.target.value)}
                      placeholder="1"
                      className="mt-1 w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                    />
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Description"
                    className="w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                  />
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-text-secondary">
                      Photos (optional — up to {MAX_IMAGES}, uploaded to IPFS)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageChange}
                      disabled={imagePreviews.length >= MAX_IMAGES}
                      className="mt-1 w-full text-sm text-white disabled:opacity-50"
                    />
                    {imagePreviews.length > 0 && (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {imagePreviews.map((preview, i) => (
                          <div key={i} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={preview}
                              alt={`Preview ${i + 1}`}
                              className="h-24 w-full rounded-lg border border-hairline-dark object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeImageAt(i)}
                              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-xs text-white"
                              aria-label={`Remove photo ${i + 1}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {imageUploadError && (
                      <p className="mt-1 text-xs text-clay">{imageUploadError}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleMint}
                    disabled={!!mintProgress || isUploadingImage}
                    className="w-full rounded-full bg-white py-2.5 text-sm font-medium text-black disabled:opacity-50"
                  >
                    {isUploadingImage
                      ? "Uploading photo…"
                      : !mintProgress
                        ? "Mint Asset"
                        : mintProgress.done >= mintProgress.total
                          ? "Minted"
                          : `Minting unit ${mintProgress.done + 1} of ${mintProgress.total}…`}
                  </button>
                  {mintingError && <p className="text-xs text-clay">{mintingError}</p>}
                </div>
              ) : (
                <p className="mt-1 text-xs text-sage">
                  Minted — token{mintedTokenIds.length > 1 ? "s" : ""} #
                  {mintedTokenIds.map((id) => id.toString()).join(", #")}
                </p>
              )}
            </div>

            {/* Step 2: Approve + List (merged — approval is a one-time blanket
                setApprovalForAll regardless of quantity, so there's no need
                for a separate click; listing loops per unit automatically) */}
            <div
              className={`rounded-xl border p-5 ${step === 2 ? "border-white" : "border-hairline-dark opacity-60"}`}
            >
              <h2 className="text-sm font-medium text-white">Step 2 — Approve &amp; List</h2>
              {step === 2 ? (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-text-secondary">
                    {mintedTokenIds.length > 1
                      ? `Same price for all ${mintedTokenIds.length} units — each lists as its own listing.`
                      : "Approves the Marketplace contract (one-time), then lists this asset."}
                  </p>
                  <input
                    type="number"
                    step="0.001"
                    value={floorPrice}
                    onChange={(e) => setFloorPrice(e.target.value)}
                    placeholder="Floor price (ETH)"
                    className="w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApproveAndListAll}
                    disabled={!!listProgress}
                    className="w-full rounded-full bg-white py-2.5 text-sm font-medium text-black disabled:opacity-50"
                  >
                    {!listProgress
                      ? "Approve & List"
                      : listProgress.phase === "approving"
                        ? listProgress.done === 0
                          ? "Confirm approval in wallet…"
                          : "Approved"
                        : `Listing ${Math.min(listProgress.done + 1, listProgress.total)} of ${listProgress.total}…`}
                  </button>
                  {listingError && <p className="text-xs text-clay">{listingError}</p>}
                </div>
              ) : step > 2 ? (
                <p className="mt-1 text-xs text-sage">Approved &amp; listed</p>
              ) : (
                <p className="mt-1 text-xs text-text-secondary">Waiting on step 1</p>
              )}
            </div>

            {/* Step 3: Approve Escrow (optional) */}
            <div
              className={`rounded-xl border p-5 ${step === 3 ? "border-white" : "border-hairline-dark opacity-60"}`}
            >
              <h2 className="text-sm font-medium text-white">
                Step 3 — Approve Escrow <span className="text-text-secondary">(optional)</span>
              </h2>
              {step === 3 ? (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-text-secondary">
                    Separate from Marketplace approval — this lets the EscrowHold contract take
                    custody of the NFT if a buyer starts a Hold &amp; Inspect on it. Skip this if
                    you don&apos;t plan to test escrow.
                  </p>
                  <button
                    type="button"
                    onClick={handleApproveEscrow}
                    disabled={isApproveEscrowPending || isApproveEscrowConfirming || !!isEscrowApproved}
                    className="w-full rounded-full bg-white py-2.5 text-sm font-medium text-black disabled:opacity-50"
                  >
                    {isEscrowApproved
                      ? "Already approved"
                      : isApproveEscrowPending
                        ? "Confirm in wallet…"
                        : isApproveEscrowConfirming
                          ? "Approving…"
                          : "Approve Escrow"}
                  </button>
                  {!!approveEscrowError && (
                    <p className="text-xs text-clay">{formatError(approveEscrowError)}</p>
                  )}
                  {(isApproveEscrowConfirmed || isEscrowApproved) && (
                    <div className="rounded-lg bg-sage/10 border border-sage/30 px-3 py-2 text-xs text-sage">
                      Done. Token{mintedTokenIds.length > 1 ? "s" : ""} #
                      {mintedTokenIds.map((id) => id.toString()).join(", #")}{" "}
                      {mintedTokenIds.length > 1 ? "are" : "is"} minted, listed, and ready for
                      Hold &amp; Inspect too.
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-text-secondary">Waiting on step 2</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
