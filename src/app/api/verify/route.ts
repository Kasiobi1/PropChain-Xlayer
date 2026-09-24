import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { signVerificationToken } from "@/lib/verificationToken";

// Real verification pipeline, per spec section 6.4.1:
//   Stage 1 (Groq, qwen/qwen3.6-27b — current Groq vision model as of Aug
//     2026): fast OCR/text extraction from the uploaded document image,
//     plus a name/address consistency check against what the seller typed.
//   Stage 2 (Groq, openai/gpt-oss-120b): the harder judgment call — does
//     this look like a real, internally-consistent document, and should
//     this submission be approved, rejected, or flagged for human review.
//     Originally planned to route through AgentRouter (a multi-LLM
//     aggregator) for this step per spec 6.4.1, but AgentRouter's client
//     fingerprinting rejects plain API requests — see runVerdict() below
//     for details. Both stages run on Groq now.
//   Stage 3 (Groq vision, optional — only runs if a selfie is provided):
//     basic liveness/face-match, comparing the selfie against the photo on
//     the ID document. See runLivenessCheck() below for the real limits of
//     this approach compared to a dedicated liveness API.
//
// NOT built: the video transcript match step from spec 6.4.1 — no service
// wired up for that yet.
//
// Response shape (restructured this session, was previously a flat
// {extraction, verdict, liveness, pipelineCoverage}):
//   { status, checks: { sellerInformation, assetInformation,
//     documentConsistency, anomalyDetection }, summary, liveness,
//     verificationToken, pipelineCoverage }
// Stage 2's prompt now asks the model directly for this per-category
// breakdown instead of one flat verdict/confidence/reasoning/flags object
// — same model, same call, just a different requested JSON shape. No
// numeric confidence score anywhere: the model is instructed to express
// uncertainty via "warning" status + explanatory text instead of a
// fabricated number.

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Robustly extracts a JSON object from a model's raw text response.
 * Some models (notably reasoning-style ones via Groq, seen in testing)
 * wrap their answer in <think>...</think> tags before the actual JSON,
 * despite being told to respond with ONLY JSON. This strips think-tags and
 * markdown fences, then falls back to locating the first balanced
 * {...} block in the text if the trimmed string still isn't valid JSON on
 * its own — more robust than assuming models always follow formatting
 * instructions exactly.
 */
function extractJson<T>(rawContent: string): T {
  let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned.replace(/```json\n?|```\n?/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to finding the first balanced {...} block anywhere in the
    // text — handles cases where the model left an unclosed <think> tag
    // (no closing tag) or added prose before/after the JSON.
    const start = cleaned.indexOf("{");
    if (start === -1) {
      throw new Error(`No JSON object found in response: ${rawContent.slice(0, 300)}`);
    }
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "{") depth++;
      if (cleaned[i] === "}") depth--;
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          throw new Error(`Found a {...} block but it wasn't valid JSON: ${candidate.slice(0, 300)}`);
        }
      }
    }
    throw new Error(`Unbalanced JSON braces in response: ${rawContent.slice(0, 300)}`);
  }
}

interface VerifyRequestBody {
  documentImageBase64: string; // data URL or raw base64, image/* mime
  selfieImageBase64?: string; // optional — if provided, runs the liveness/face-match stage
  sellerStatedName: string;
  assetType: string;
  assetDescription: string;
  // The seller's connected wallet — required so the verification token
  // issued below can be bound to this address. /api/mint-listing checks
  // the token was issued for the same toAddress it's about to mint to, so
  // a verdict approved for one wallet can't be replayed against another.
  walletAddress: string;
}

interface GroqExtractionResult {
  extractedText: string;
  extractedName: string | null;
  extractedAddress: string | null;
  nameMatchesStatement: boolean | null;
  documentLooksLegible: boolean;
}

async function runGroqExtraction(
  imageDataUrl: string,
  sellerStatedName: string
): Promise<GroqExtractionResult> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }

  const prompt = `You are extracting information from a real-world asset ownership document (deed, certificate of occupancy, receipt, or similar) as part of a marketplace verification pipeline. Extract exactly what is on the document — do not infer or guess.

The seller has stated their name as: "${sellerStatedName}"

Respond ONLY with valid JSON — no markdown fences, no <think> tags, no reasoning text before or after, just the raw JSON object, in this exact shape:
{
  "extractedText": "full text you can read from the document, verbatim",
  "extractedName": "the owner/holder name as printed on the document, or null if not found",
  "extractedAddress": "the property/asset address as printed, or null if not found",
  "nameMatchesStatement": true or false or null (null if extractedName is null),
  "documentLooksLegible": true or false
}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen/qwen3.6-27b",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_completion_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  try {
    return extractJson<GroqExtractionResult>(content);
  } catch (err) {
    throw new Error(
      `Groq returned unparseable JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export type CheckStatus = "pass" | "fail" | "warning";

export interface CheckResult {
  status: CheckStatus;
  detail: string;
}

export interface StructuredVerdict {
  status: "approve" | "reject" | "review";
  checks: {
    sellerInformation: CheckResult;
    assetInformation: CheckResult;
    documentConsistency: CheckResult;
    anomalyDetection: CheckResult;
  };
  summary: string;
}

async function runVerdict(
  extraction: GroqExtractionResult,
  sellerStatedName: string,
  assetType: string,
  assetDescription: string
): Promise<StructuredVerdict> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }

  const prompt = `You are the final verification judgment step for PropChain, a marketplace that tokenizes real-world assets (houses, land, phones, gadgets, cars) as NFTs. Every listing must pass document verification before it can be minted.

You are reviewing a document extraction from an earlier fast OCR pass. Your job is NOT to re-read the document — you don't have the image. Your job is to reason about whether the extraction is internally consistent and plausible, and flag anything suspicious.

Seller-stated name: "${sellerStatedName}"
Asset type: "${assetType}"
Asset description (seller-provided): "${assetDescription}"

Document extraction from OCR pass:
${JSON.stringify(extraction, null, 2)}

Evaluate these four things separately:
1. Seller information — does the extracted name match the seller's stated name? Mention what was actually extracted.
2. Asset information — is what's on the document consistent with the asset type and description the seller gave?
3. Document consistency — is the document itself internally consistent and legible enough to trust?
4. Anomaly detection — anything suspicious, incomplete, or out of place. If nothing stands out, say so plainly.

Respond ONLY with valid JSON — no markdown fences, no <think> tags, no reasoning text before or after, just the raw JSON object, in this exact shape:
{
  "status": "approve" | "reject" | "review",
  "checks": {
    "sellerInformation": { "status": "pass" | "fail" | "warning", "detail": "one sentence" },
    "assetInformation": { "status": "pass" | "fail" | "warning", "detail": "one sentence" },
    "documentConsistency": { "status": "pass" | "fail" | "warning", "detail": "one sentence" },
    "anomalyDetection": { "status": "pass" | "fail" | "warning", "detail": "one sentence, or 'No anomalies detected.' if none" }
  },
  "summary": "2-3 sentences giving the overall picture and explaining the status"
}

Use "warning" for anything you're genuinely unsure about rather than guessing pass or fail. Do not invent a numeric confidence score anywhere in your answer — express uncertainty in the detail/summary text instead.`;

  // Uses Groq for both pipeline stages. AgentRouter (originally planned for
  // this step, per spec 6.4.1's "multi-LLM aggregator" framing) was dropped
  // after hitting their client-fingerprint WAF, which rejects plain API
  // requests with "unauthorized client detected" unless the request spoofs
  // specific third-party client headers — a documented but ToS-risky
  // workaround. Not worth it when Groq already works cleanly end-to-end.
  // openai/gpt-oss-120b is Groq's current strong reasoning model, replacing
  // the now-deprecated llama-3.3-70b-versatile.
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_completion_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  try {
    return extractJson<StructuredVerdict>(content);
  } catch (err) {
    throw new Error(
      `Groq returned unparseable JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

interface LivenessResult {
  sameFaceLikely: boolean;
  livenessConfidence: number; // 0-1, see honesty caveat in the prompt/comment below
  reasoning: string;
  concerns: string[];
}

/**
 * IMPORTANT HONESTY NOTE: this is NOT real liveness detection. Dedicated
 * liveness APIs (AWS Rekognition's Face Liveness, iProov, Facia, etc.) use
 * specialized models trained specifically to detect spoofing signals —
 * unnatural skin texture, screen glare/moire patterns from photographing a
 * photo, lack of micro-movements in video, etc. A general vision-language
 * model like Groq's qwen3.6-27b was NOT trained for this and cannot
 * reliably tell a live selfie apart from a photo of a photo, a printed
 * mask, or a well-lit screen replay. This function only does two much
 * weaker things: (1) a basic "do these two faces look like the same
 * person" comparison, and (2) asks the model to note anything visually
 * obvious (e.g. clear screen bezels in frame). Treat this as a placeholder
 * pending a real liveness API integration — the response fields are named
 * to make that limitation clear rather than implying more confidence than
 * this check can actually provide.
 */
async function runLivenessCheck(
  documentImageDataUrl: string,
  selfieImageDataUrl: string
): Promise<LivenessResult> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }

  const prompt = `You are comparing two images as part of a basic identity check: an ID/ownership document (which may contain a photo of the holder) and a separate selfie photo submitted by the same person.

Look at both images. Consider:
- Does the face in the selfie plausibly match the face in the document photo (if the document has a visible face)?
- Does the selfie look like a normal live photo, or does it show obvious signs of being a photo-of-a-photo or a screen (visible bezels, screen glare, moire/pixel patterns, a hand holding another device)?

Be honest about uncertainty — this is a basic check, not a forensic one. If the document has no visible face to compare against, say so.

Respond ONLY with valid JSON — no markdown fences, no <think> tags, no reasoning text before or after, just the raw JSON object, in this exact shape:
{
  "sameFaceLikely": true or false,
  "livenessConfidence": 0.0 to 1.0 (your confidence this is a live, non-spoofed photo — be conservative),
  "reasoning": "2-3 sentences explaining your assessment",
  "concerns": ["short flag strings for anything concerning, e.g. 'no face visible on document', empty array if none"]
}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen/qwen3.6-27b",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "text", text: "Document image:" },
            { type: "image_url", image_url: { url: documentImageDataUrl } },
            { type: "text", text: "Selfie image:" },
            { type: "image_url", image_url: { url: selfieImageDataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_completion_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  try {
    return extractJson<LivenessResult>(content);
  } catch (err) {
    throw new Error(
      `Groq returned unparseable JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: VerifyRequestBody = await req.json();

    if (!body.documentImageBase64 || !body.sellerStatedName) {
      return NextResponse.json(
        { error: "documentImageBase64 and sellerStatedName are required." },
        { status: 400 }
      );
    }
    if (!body.walletAddress || !isAddress(body.walletAddress)) {
      return NextResponse.json(
        { error: "A valid walletAddress is required to bind the verification token." },
        { status: 400 }
      );
    }

    const extraction = await runGroqExtraction(body.documentImageBase64, body.sellerStatedName);
    const verdict = await runVerdict(
      extraction,
      body.sellerStatedName,
      body.assetType ?? "Other",
      body.assetDescription ?? ""
    );

    // Approval rule: 3 of 4 checks passing is enough to approve, regardless
    // of the model's own status label. Fewer than 3: reject if any check
    // failed outright, otherwise send to manual review.
    const checkList = Object.values(verdict.checks);
    const passCount = checkList.filter((c) => c.status === "pass").length;
    const anyFail = checkList.some((c) => c.status === "fail");
    verdict.status = passCount >= 3 ? "approve" : anyFail ? "reject" : "review";

    let liveness: LivenessResult | null = null;
    if (body.selfieImageBase64) {
      liveness = await runLivenessCheck(body.documentImageBase64, body.selfieImageBase64);
    }

    // Sign a token regardless of the verdict value — /api/mint-listing's
    // verifyVerificationToken() rejects anything whose embedded verdict
    // isn't "approve", so issuing one here for reject/review too keeps the
    // check logic in one place rather than duplicating it here.
    const verificationToken = signVerificationToken(body.walletAddress, verdict.status);

    return NextResponse.json({
      status: verdict.status,
      checks: verdict.checks,
      summary: verdict.summary,
      liveness,
      verificationToken,
      // Honest disclosure of what this pipeline does NOT cover, per spec
      // 6.4.1. livenessCheck is true only when a selfie was actually
      // submitted — and even then, see the honesty note on
      // runLivenessCheck() above: this is a basic vision-model comparison,
      // not a dedicated liveness/anti-spoofing API.
      pipelineCoverage: {
        documentOcr: true,
        nameConsistency: true,
        documentAuthenticityReasoning: true,
        livenessCheck: !!liveness,
        livenessCheckIsBasicNotDedicated: true,
        videoTranscriptMatch: false,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification pipeline failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
