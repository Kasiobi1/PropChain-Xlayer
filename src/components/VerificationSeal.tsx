interface VerificationSealProps {
  size?: "sm" | "md";
  // "org" = minted via /admin/mint, for organizations/agents the operator
  // has personally confirmed the identity of — shown in blue. "standard"
  // (default) = minted via /list, the regular AI-document-verification
  // path any seller goes through — shown in gray. Both are genuinely
  // AI-verified per this component's original premise; this only
  // distinguishes the extra layer of personal identity confirmation the
  // /admin/mint path represents, it doesn't mean /list sellers are
  // unverified.
  variant?: "standard" | "org";
}

/**
 * The signature element: a notary-style stamp that marks AI-verified listings.
 * Every listing on PropChain passed document + identity verification before
 * minting (see AssetNFT.sol — mint is gated to the verifier wallet only after
 * AI approval), so this mark is never conditional on verification having
 * happened — it's the whole premise of the marketplace, made visible. The
 * color variant marks something else: whether the operator has additionally,
 * personally confirmed this seller is a real organization (blue) versus the
 * standard AI-only path every /list seller goes through (gray).
 */
export function VerificationSeal({ size = "md", variant = "standard" }: VerificationSealProps) {
  const dimensions = size === "sm" ? "h-8 w-8" : "h-11 w-11";
  const strokeW = size === "sm" ? 1.25 : 1.5;
  const colorClasses =
    variant === "org"
      ? "border-sky-400/70 bg-sky-950 text-sky-300"
      : "border-white/30 bg-ink-raised text-text-secondary";

  return (
    <div
      className={`${dimensions} ${colorClasses} relative shrink-0 rounded-full border transition-transform duration-300 ease-out group-hover:rotate-[8deg] group-hover:scale-105`}
      role="img"
      aria-label={variant === "org" ? "Verified organization listing" : "AI-verified listing"}
    >
      <svg viewBox="0 0 44 44" className="h-full w-full">
        <circle
          cx="22"
          cy="22"
          r="19.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeW}
          strokeDasharray="2.2 2.6"
          opacity="0.6"
        />
        <circle cx="22" cy="22" r="15.5" fill="none" stroke="currentColor" strokeWidth={strokeW} />
        <path
          d="M14.5 22.5l4.8 4.8L29.5 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeW + 0.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
