import { createHmac, timingSafeEqual } from "crypto";

// Closes a real security hole in /api/mint-listing: that route used to
// trust a raw `{"verdict": "approve"}` field sent straight from the
// browser — anyone could fake that via curl/devtools and mint without
// ever passing real AI verification.
//
// Fix: /api/verify signs a short-lived token binding {walletAddress,
// verdict, expiry} with HMAC-SHA256 over VERIFICATION_TOKEN_SECRET.
// /api/mint-listing must present this token and have it independently
// re-verified server-side (signature + expiry + wallet match + verdict
// === "approve") instead of trusting anything the client asserts about
// its own verdict.
//
// Token shape: `${base64url(JSON payload)}.${hex HMAC signature}` — not a
// JWT, no need for the extra header/alg-negotiation surface JWTs carry,
// just the two pieces this project actually needs.

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

export type VerificationTokenVerdict = "approve" | "reject" | "review";

interface VerificationTokenPayload {
  walletAddress: string; // always stored lowercased
  verdict: VerificationTokenVerdict;
  issuedAt: number;
  expiresAt: number;
}

function getSecret(): string {
  const secret = process.env.VERIFICATION_TOKEN_SECRET;
  if (!secret) {
    throw new Error("VERIFICATION_TOKEN_SECRET is not configured on the server.");
  }
  return secret;
}

function signPayload(payloadB64: string): string {
  return createHmac("sha256", getSecret()).update(payloadB64).digest("hex");
}

/**
 * Issues a signed verification token for a given wallet + verdict pair.
 * Called from /api/verify right after the AI pipeline produces a verdict.
 */
export function signVerificationToken(
  walletAddress: string,
  verdict: VerificationTokenVerdict,
  ttlMs: number = DEFAULT_TTL_MS
): string {
  const now = Date.now();
  const payload: VerificationTokenPayload = {
    walletAddress: walletAddress.toLowerCase(),
    verdict,
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export interface VerificationTokenCheckResult {
  valid: boolean;
  verdict?: VerificationTokenVerdict;
  error?: string;
}

/**
 * Independently re-verifies a token — signature, expiry, wallet match, and
 * verdict all checked server-side. Called from /api/mint-listing; never
 * trust body.verdict directly again.
 */
export function verifyVerificationToken(
  token: string | undefined | null,
  expectedWalletAddress: string
): VerificationTokenCheckResult {
  if (!token) {
    return { valid: false, error: "Missing verification token — submit for verification again." };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Malformed verification token." };
  }
  const [payloadB64, signature] = parts;

  let expectedSignature: string;
  try {
    expectedSignature = signPayload(payloadB64);
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Token verification failed." };
  }

  // Timing-safe comparison — a plain === here would leak signature bytes
  // through response-time differences.
  const providedBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, error: "Verification token signature is invalid." };
  }

  let payload: VerificationTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { valid: false, error: "Verification token payload was not valid JSON." };
  }

  if (Date.now() > payload.expiresAt) {
    return { valid: false, error: "Verification token has expired — please re-verify." };
  }

  if (payload.walletAddress !== expectedWalletAddress.toLowerCase()) {
    return { valid: false, error: "Verification token was issued for a different wallet address." };
  }

  if (payload.verdict !== "approve") {
    return {
      valid: false,
      verdict: payload.verdict,
      error: `Verification verdict was '${payload.verdict}', not 'approve'.`,
    };
  }

  return { valid: true, verdict: payload.verdict };
}
