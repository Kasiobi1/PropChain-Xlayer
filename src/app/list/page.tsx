"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { parseEther, BaseError, ContractFunctionRevertedError } from "viem";
import { useWallet, getWalletClient, getPublicClient } from "@/lib/walletConnect";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { NetworkToggle } from "@/components/NetworkToggle";
import { CONTRACT_ADDRESSES, ACTIVE_CHAIN_ID } from "@/lib/contracts";
import { ASSET_NFT_ABI, ASSET_TYPE_ENUM } from "@/lib/assetNftAbi";
import { MARKETPLACE_ABI } from "@/lib/marketplaceAbi";
import { LISTING_REQUIREMENTS } from "@/lib/listingRequirements";

type Stage = "form" | "verifying" | "verdict" | "minting" | "list" | "approveEscrow" | "done";

interface CheckResult {
  status: "pass" | "fail" | "warning";
  detail: string;
}

interface VerifyResponse {
  status: "approve" | "reject" | "review";
  checks: {
    sellerInformation: CheckResult;
    assetInformation: CheckResult;
    documentConsistency: CheckResult;
    anomalyDetection: CheckResult;
  };
  summary: string;
  liveness: {
    sameFaceLikely: boolean;
    livenessConfidence: number;
    reasoning: string;
    concerns: string[];
  } | null;
  pipelineCoverage: Record<string, boolean>;
  // Signed, wallet-bound, short-lived (15 min) — required by /api/mint-listing
  // now instead of a raw verdict string. See src/lib/verificationToken.ts.
  verificationToken: string;
}

// Purely visual — the pipeline is still one request/response (no
// server-sent progress), so these are timed guesses at what's likely
// happening server-side. handleSubmitForVerification caps the advance at
// the last step and holds it there (spinner-style) until the real
// response comes back, so it never claims a step finished ahead of the
// actual result.
const VERIFY_STEPS = ["Document received", "Reading document", "Comparing information", "Checking for anomalies"];

const CHECK_LABELS: [keyof VerifyResponse["checks"], string][] = [
  ["sellerInformation", "Seller information"],
  ["assetInformation", "Asset information"],
  ["documentConsistency", "Document consistency"],
  ["anomalyDetection", "Anomaly detection"],
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ListAssetPage() {
  const { address, connected: isConnected, chainId, switchToActiveChain } = useWallet();

  const [stage, setStage] = useState<Stage>("form");
  const [sellerName, setSellerName] = useState("");
  const [assetType, setAssetType] = useState<(typeof ASSET_TYPE_ENUM)[number]>("Land");
  const [supply, setSupply] = useState("1");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [extraDetail, setExtraDetail] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const MAX_IMAGES = 5;
  const [productPhotoPreviews, setProductPhotoPreviews] = useState<string[]>([]);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [floorPrice, setFloorPrice] = useState("0.01");

  const requirement = LISTING_REQUIREMENTS[assetType];

  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyStepIndex, setVerifyStepIndex] = useState(0);
  // One entry per physical unit minted — a quantity-of-1 listing still gets
  // a one-element array, so the rest of the flow doesn't need a separate
  // single-vs-batch code path.
  const [mintedTokenIds, setMintedTokenIds] = useState<bigint[]>([]);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintProgress, setMintProgress] = useState<{ done: number; total: number } | null>(null);
  const [listProgress, setListProgress] = useState<{
    phase: "approving" | "listing";
    done: number;
    total: number;
  } | null>(null);
  const [listingError, setListingError] = useState<string | null>(null);

  // Replaces wagmi's useWriteContract/useWaitForTransactionReceipt for the
  // "Approve Escrow" step — tracked with plain state since there's only ever
  // one in-flight write here. See admin/mint/page.tsx for the identical
  // pattern this mirrors.
  const [isApproveEscrowPending, setIsApproveEscrowPending] = useState(false);
  const [isApproveEscrowConfirming, setIsApproveEscrowConfirming] = useState(false);
  const [isApproveEscrowConfirmed, setIsApproveEscrowConfirmed] = useState(false);
  const [approveEscrowError, setApproveEscrowError] = useState<unknown>(null);
  const [isEscrowApproved, setIsEscrowApproved] = useState<boolean | undefined>(undefined);

  // Refreshes the isApprovedForAll read whenever the approveEscrow stage
  // becomes active or right after a successful approval — replaces
  // wagmi's useReadContract({ query: { enabled } }) reactivity.
  useEffect(() => {
    if (!address || stage !== "approveEscrow") return;
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
  }, [address, stage, isApproveEscrowConfirmed]);

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    setFilePreview(dataUrl);
  }

  async function handleSelfieChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    setSelfiePreview(dataUrl);
  }

  async function handleProductPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setImageUploadError(null);

    const remainingSlots = MAX_IMAGES - productPhotoPreviews.length;
    if (remainingSlots <= 0) {
      setImageUploadError(`You can upload up to ${MAX_IMAGES} photos.`);
      return;
    }
    const filesToAdd = files.slice(0, remainingSlots);

    for (const f of filesToAdd) {
      const dataUrl = await fileToDataUrl(f);
      setProductPhotoPreviews((prev) => [...prev, dataUrl]);
    }
  }

  function removeProductPhotoAt(index: number) {
    setProductPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmitForVerification() {
    if (!filePreview || !sellerName || !description) {
      setVerifyError("Fill in your name, a description, and upload a document first.");
      return;
    }
    if (!address) {
      setVerifyError("Wallet disconnected — reconnect your wallet and try again.");
      return;
    }
    setStage("verifying");
    setVerifyError(null);
    setVerifyStepIndex(0); // "Document received" — already true, it's in memory client-side

    // Advances the visual step indicator while the single /api/verify call
    // is in flight. Capped at the last step and held there until the real
    // response arrives — never marks "Checking for anomalies" done before
    // the actual result comes back.
    const stepTimer = setInterval(() => {
      setVerifyStepIndex((i) => Math.min(i + 1, VERIFY_STEPS.length - 1));
    }, 1100);

    const fullDescription = extraDetail ? `${description} (${extraDetail})` : description;

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentImageBase64: filePreview,
          selfieImageBase64: selfiePreview || undefined,
          sellerStatedName: sellerName,
          assetType,
          assetDescription: fullDescription,
          walletAddress: address,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }
      setVerifyResult(data);
      setStage("verdict");
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed.");
      setStage("form");
    } finally {
      clearInterval(stepTimer);
    }
  }

  async function handleMint() {
    if (!address || !verifyResult) return;
    setStage("minting");
    setMintError(null);
    setMintProgress(null);

    const fullDescription = extraDetail ? `${description} (${extraDetail})` : description;
    const quantity = Math.max(1, Number(supply) || 1);

    // Product photos are separate from the verification document — uploads
    // to Pinata sequentially (simpler error reporting than parallel),
    // degrades gracefully (mint still proceeds without photos) if any fail,
    // same pattern as /admin/mint. Every unit in this batch is identical,
    // so this happens once and the same URLs get reused for each mint call
    // below rather than re-uploading per unit.
    const imageUrls: string[] = [];
    for (const preview of productPhotoPreviews) {
      try {
        const uploadRes = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: preview }),
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) {
          imageUrls.push(uploadData.url as string);
        }
      } catch {
        // Non-fatal — continue with whatever photos succeeded.
      }
    }

    // Real multi-unit support: instead of one token whose metadata.supply
    // says "5" (cosmetic only — Marketplace has no partial-sale logic and
    // never did), this mints `quantity` separate tokens, each a genuinely
    // independent NFT representing one physical unit, sharing a batchId so
    // the frontend can group them and count how many are still Active. A
    // quantity of 1 skips batchId entirely and behaves exactly as before.
    const batchId = quantity > 1 ? crypto.randomUUID() : undefined;

    try {
      const newTokenIds: bigint[] = [];
      for (let i = 0; i < quantity; i++) {
        setMintProgress({ done: i, total: quantity });
        const res = await fetch("/api/mint-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toAddress: address,
            assetType,
            supply: 1, // each minted token is genuinely one unit now, not a cosmetic count
            sellerStatedName: sellerName,
            assetDescription: fullDescription,
            assetLocation: location || undefined,
            imageUrls,
            batchId,
            verificationToken: verifyResult.verificationToken,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Minting unit ${i + 1} of ${quantity} failed.`);
        }
        newTokenIds.push(BigInt(data.tokenId));
      }
      setMintProgress({ done: quantity, total: quantity });
      setMintedTokenIds(newTokenIds);
      setStage("list");
    } catch (err) {
      setMintError(err instanceof Error ? err.message : "Mint failed.");
      setStage("verdict");
    }
  }

  // Approves once (blanket setApprovalForAll — unaffected by quantity, same
  // as before) then lists every minted unit sequentially. Uses viem's
  // walletClient/publicClient directly instead of a declarative write hook,
  // since a single hook only tracks one in-flight transaction at a time —
  // fine for a single approve-then-list, but awkward to chain N sequential
  // list calls through without a manual queue. formatError() below still
  // applies to whatever it throws, since viem's error types are unchanged.
  async function handleListAll() {
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
      setStage("approveEscrow");
    } catch (err) {
      setListingError(formatError(err));
    }
  }

  // Replaces wagmi's declarative useWriteContract for this one button —
  // tracked with plain state since there's only ever one in-flight write
  // here. See admin/mint/page.tsx for the identical pattern.
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

        <main className="mx-auto max-w-xl px-4 py-12 sm:px-8">
          <h1 className="font-display text-2xl text-white">List an asset</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Upload proof of ownership. Every submission runs through AI document verification
            before it can be minted — nothing reaches the marketplace unchecked.
          </p>

          {!isConnected ? (
            <p className="mt-6 rounded-lg bg-surface px-4 py-3 text-sm text-text-secondary">
              Connect your wallet to continue.
            </p>
          ) : (
            <div className="mt-8 space-y-6">
              {stage === "form" && (
                <div className="rounded-xl border border-hairline-dark bg-surface p-5">
                  <label className="text-[11px] uppercase tracking-wide text-text-secondary">
                    Your name (as it appears on the document)
                  </label>
                  <input
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    placeholder="e.g. Adaeze Okonkwo"
                    className="mt-2 w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                  />

                  <label className="mt-4 block text-[11px] uppercase tracking-wide text-text-secondary">
                    Asset type
                  </label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value as typeof assetType)}
                    className="mt-2 w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                  >
                    {ASSET_TYPE_ENUM.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  <label className="mt-4 block text-[11px] uppercase tracking-wide text-text-secondary">
                    How many identical units?
                  </label>
                  <p className="mt-1 text-[11px] text-text-secondary">
                    For 2+, each unit mints and lists as its own separate NFT — a buyer can
                    purchase any number of them, and each is a real, whole asset. Use this only
                    for genuinely identical physical units (e.g. 5 of the same phone model), not
                    shared ownership of one item.
                  </p>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={supply}
                    onChange={(e) => setSupply(e.target.value)}
                    placeholder="1"
                    className="mt-2 w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                  />

                  <label className="mt-4 block text-[11px] uppercase tracking-wide text-text-secondary">
                    Location
                  </label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Lekki, Lagos"
                    className="mt-2 w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                  />

                  <label className="mt-4 block text-[11px] uppercase tracking-wide text-text-secondary">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Brief description of the asset"
                    className="mt-2 w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                  />

                  {requirement.extraFieldLabel && (
                    <>
                      <label className="mt-4 block text-[11px] uppercase tracking-wide text-text-secondary">
                        {requirement.extraFieldLabel}
                      </label>
                      <input
                        value={extraDetail}
                        onChange={(e) => setExtraDetail(e.target.value)}
                        placeholder={requirement.extraFieldPlaceholder}
                        className="mt-2 w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                      />
                    </>
                  )}

                  <label className="mt-4 block text-[11px] uppercase tracking-wide text-text-secondary">
                    {requirement.documentLabel}
                  </label>
                  <p className="mt-1 text-[11px] text-text-secondary">{requirement.documentHint}</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="mt-2 w-full text-sm text-white"
                  />
                  {filePreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={filePreview}
                      alt="Document preview"
                      className="mt-3 max-h-48 rounded-lg border border-hairline-dark object-contain"
                    />
                  )}

                  <label className="mt-4 block text-[11px] uppercase tracking-wide text-text-secondary">
                    Selfie (optional — for basic identity liveness check)
                  </label>
                  <p className="mt-1 text-[11px] text-text-secondary">
                    A separate photo of your face, taken now. Compared against the photo on your
                    document, if it has one.
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSelfieChange}
                    className="mt-2 w-full text-sm text-white"
                  />
                  {selfiePreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selfiePreview}
                      alt="Selfie preview"
                      className="mt-3 max-h-48 rounded-lg border border-hairline-dark object-contain"
                    />
                  )}

                  <label className="mt-4 block text-[11px] uppercase tracking-wide text-text-secondary">
                    Product photos (optional — up to {MAX_IMAGES}, shown on the marketplace listing)
                  </label>
                  <p className="mt-1 text-[11px] text-text-secondary">
                    Real photos of the asset itself — not the ownership document. This is what
                    buyers see on the listing.
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleProductPhotoChange}
                    disabled={productPhotoPreviews.length >= MAX_IMAGES}
                    className="mt-2 w-full text-sm text-white disabled:opacity-50"
                  />
                  {productPhotoPreviews.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {productPhotoPreviews.map((preview, i) => (
                        <div key={i} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={preview}
                            alt={`Preview ${i + 1}`}
                            className="h-24 w-full rounded-lg border border-hairline-dark object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeProductPhotoAt(i)}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-xs text-white"
                            aria-label={`Remove photo ${i + 1}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {imageUploadError && <p className="mt-1 text-xs text-clay">{imageUploadError}</p>}

                  <button
                    type="button"
                    onClick={handleSubmitForVerification}
                    className="mt-5 w-full rounded-full bg-white py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-85"
                  >
                    Submit for verification
                  </button>

                  {verifyError && (
                    <p className="mt-3 rounded-lg bg-clay/10 border border-clay/30 px-3 py-2 text-xs text-clay">
                      {verifyError}
                    </p>
                  )}
                </div>
              )}

              {stage === "verifying" && (
                <div className="rounded-xl border border-hairline-dark bg-surface p-6">
                  <p className="text-sm text-white">Running AI verification…</p>
                  <ul className="mt-4 space-y-2.5">
                    {VERIFY_STEPS.map((step, i) => (
                      <li key={step} className="flex items-center gap-2.5 text-sm">
                        <span
                          className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs ${
                            i < verifyStepIndex
                              ? "bg-sage/20 text-sage"
                              : i === verifyStepIndex
                                ? "bg-white/10 text-white"
                                : "bg-white/5 text-text-secondary"
                          }`}
                        >
                          {i < verifyStepIndex ? "✓" : i === verifyStepIndex ? "●" : "○"}
                        </span>
                        <span className={i <= verifyStepIndex ? "text-white" : "text-text-secondary"}>
                          {step}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-text-secondary">This usually takes a few seconds.</p>
                </div>
              )}

              {stage === "verdict" && verifyResult && (
                <div className="rounded-xl border border-hairline-dark bg-surface p-5">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium uppercase ${
                      verifyResult.status === "approve"
                        ? "bg-sage/15 text-sage"
                        : verifyResult.status === "reject"
                          ? "bg-clay/15 text-clay"
                          : "bg-seal-gold-soft/20 text-seal-gold-soft"
                    }`}
                  >
                    {verifyResult.status}
                  </span>

                  <p className="mt-3 text-sm text-white">{verifyResult.summary}</p>

                  <div className="mt-4 space-y-3 border-t border-hairline-dark pt-3">
                    {CHECK_LABELS.map(([key, label]) => {
                      const check = verifyResult.checks[key];
                      return (
                        <div key={key}>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                check.status === "pass"
                                  ? "text-sage"
                                  : check.status === "fail"
                                    ? "text-clay"
                                    : "text-seal-gold-soft"
                              }
                            >
                              {check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "⚠"}
                            </span>
                            <span className="text-[11px] uppercase tracking-wide text-text-secondary">
                              {label}
                            </span>
                          </div>
                          <p className="mt-0.5 pl-5 text-xs text-white">{check.detail}</p>
                        </div>
                      );
                    })}
                  </div>

                  {verifyResult.liveness && (
                    <div className="mt-4 border-t border-hairline-dark pt-3">
                      <p className="text-[11px] uppercase tracking-wide text-text-secondary">
                        Liveness / face check (basic)
                      </p>
                      <p className="mt-1 text-xs text-white">
                        Same face likely: {verifyResult.liveness.sameFaceLikely ? "Yes" : "No"} ·
                        Confidence: {Math.round(verifyResult.liveness.livenessConfidence * 100)}%
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {verifyResult.liveness.reasoning}
                      </p>
                      {verifyResult.liveness.concerns.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {verifyResult.liveness.concerns.map((c) => (
                            <li key={c} className="text-xs text-clay">
                              ⚠ {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <p className="mt-3 text-[10px] text-text-secondary">
                    {verifyResult.liveness
                      ? "The liveness check above is a basic AI face comparison, not a dedicated anti-spoofing liveness API — it can't reliably catch a photo-of-a-photo or a mask the way specialized tools (e.g. AWS Rekognition Face Liveness) can. Video transcript matching isn't built yet."
                      : "No selfie was submitted, so no liveness/face check ran. Video transcript matching isn't built yet."}
                  </p>

                  {verifyResult.status === "approve" ? (
                    <button
                      type="button"
                      onClick={handleMint}
                      className="mt-4 w-full rounded-full bg-white py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-85"
                    >
                      Mint asset
                    </button>
                  ) : (
                    <p className="mt-4 text-xs text-text-secondary">
                      This submission wasn&apos;t approved automatically — resubmission or manual
                      review would be the next step (not built yet).
                    </p>
                  )}

                  {mintError && (
                    <p className="mt-3 rounded-lg bg-clay/10 border border-clay/30 px-3 py-2 text-xs text-clay">
                      {mintError}
                    </p>
                  )}
                </div>
              )}

              {stage === "minting" && (
                <div className="rounded-xl border border-hairline-dark bg-surface p-6 text-center">
                  <p className="text-sm text-white">
                    {mintProgress
                      ? `Minting unit ${Math.min(mintProgress.done + 1, mintProgress.total)} of ${mintProgress.total}…`
                      : "Minting your asset…"}
                  </p>
                </div>
              )}

              {(stage === "list" || stage === "approveEscrow" || stage === "done") &&
                mintedTokenIds.length > 0 && (
                  <div className="rounded-xl border border-sage/30 bg-sage/5 p-4 text-sm text-sage">
                    Minted — token{mintedTokenIds.length > 1 ? "s" : ""} #
                    {mintedTokenIds.map((id) => id.toString()).join(", #")}
                  </div>
                )}

              {stage === "list" && (
                <div className="rounded-xl border border-hairline-dark bg-surface p-5">
                  <h2 className="text-sm font-medium text-white">Set your price</h2>
                  <p className="mt-1 text-xs text-text-secondary">
                    {mintedTokenIds.length > 1
                      ? `Same price for all ${mintedTokenIds.length} units — each lists as its own listing.`
                      : "This is what buyers will pay."}
                  </p>
                  <input
                    type="number"
                    step="0.001"
                    value={floorPrice}
                    onChange={(e) => setFloorPrice(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-hairline-dark bg-ink px-3 py-2 text-sm text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleListAll}
                    disabled={!!listProgress}
                    className="mt-3 w-full rounded-full bg-white py-2.5 text-sm font-medium text-black disabled:opacity-50"
                  >
                    {!listProgress
                      ? "List for sale"
                      : listProgress.phase === "approving"
                        ? listProgress.done === 0
                          ? "Confirm approval in wallet…"
                          : "Approved"
                        : `Listing ${Math.min(listProgress.done + 1, listProgress.total)} of ${listProgress.total}…`}
                  </button>
                  {listingError && <p className="mt-3 text-xs text-clay">{listingError}</p>}
                </div>
              )}

              {stage === "approveEscrow" && (
                <div className="rounded-xl border border-hairline-dark bg-surface p-5">
                  <h2 className="text-sm font-medium text-white">
                    Approve Escrow <span className="text-text-secondary">(optional)</span>
                  </h2>
                  <p className="mt-1 text-xs text-text-secondary">
                    Separate from Marketplace approval — this lets EscrowHold take custody of the
                    NFT if a buyer starts a Hold &amp; Inspect on it. Skip if you don&apos;t need
                    that option.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleApproveEscrow}
                      disabled={isApproveEscrowPending || isApproveEscrowConfirming || !!isEscrowApproved}
                      className="flex-1 rounded-full bg-white py-2.5 text-sm font-medium text-black disabled:opacity-50"
                    >
                      {isEscrowApproved
                        ? "Already approved"
                        : isApproveEscrowPending
                          ? "Confirm in wallet…"
                          : isApproveEscrowConfirming
                            ? "Approving…"
                            : "Approve Escrow"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStage("done")}
                      className="rounded-full border border-hairline-dark px-5 py-2.5 text-sm text-text-secondary hover:text-white"
                    >
                      Skip
                    </button>
                  </div>
                  {!!approveEscrowError && (
                    <p className="mt-3 text-xs text-clay">{formatError(approveEscrowError)}</p>
                  )}
                  {(isApproveEscrowConfirmed || isEscrowApproved) && (
                    <button
                      type="button"
                      onClick={() => setStage("done")}
                      className="mt-3 w-full rounded-full border border-sage/30 bg-sage/5 py-2.5 text-sm text-sage"
                    >
                      Continue
                    </button>
                  )}
                </div>
              )}

              {stage === "done" && mintedTokenIds.length > 0 && (
                <div className="rounded-xl border border-sage/30 bg-sage/5 p-5 text-sm text-sage">
                  {mintedTokenIds.length > 1
                    ? `All ${mintedTokenIds.length} units are live.`
                    : "Your asset is live."}{" "}
                  <Link href={`/listing/real-${mintedTokenIds[0]}`} className="underline">
                    View it
                  </Link>
                </div>
              )}
            </div>
          )}
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
