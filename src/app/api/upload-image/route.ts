import { NextRequest, NextResponse } from "next/server";
import { normalizeImageUrl } from "@/lib/assetMetadata";

// Uploads a real image to IPFS via Pinata, so listings can have a real
// photo instead of just the illustrated placeholder thumbnails. The JWT
// stays server-side — the browser sends image data to this route, this
// route sends it on to Pinata.
//
// REPLACES the previous ipfs.ninja integration: ipfs.ninja shut down
// entirely (confirmed via a live 402 response — "IPFS.NINJA is winding
// down. New uploads have been disabled") and every photo upload had been
// silently failing as a result. This is the same fix already applied on
// PropChain's Nimiq track — ported here since this X Layer codebase was
// forked from the pre-migration snapshot, before that fix existed.
//
// Built against Pinata's documented v3 Files API (docs.pinata.cloud):
//   POST https://uploads.pinata.cloud/v3/files
//   Headers: Authorization: Bearer <PINATA_JWT>
//   Body: multipart/form-data, field "file" (a File/Blob), field
//     "network" = "public"
//   Response: { data: { cid, id, ... } }

const PINATA_JWT = process.env.PINATA_JWT;

export async function POST(req: NextRequest) {
  try {
    if (!PINATA_JWT) {
      return NextResponse.json(
        { error: "PINATA_JWT is not configured on the server." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { imageBase64 } = body as { imageBase64?: string };

    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 is required." }, { status: 400 });
    }

    // Split the data: URI prefix (if present) to get the raw base64 and
    // the mime type, since Pinata's multipart upload needs an actual
    // File/Blob, not a base64 string directly.
    const match = imageBase64.match(/^data:(.+);base64,(.*)$/);
    const mimeType = match?.[1] ?? "image/jpeg";
    const rawBase64 = match?.[2] ?? imageBase64;
    const bytes = Buffer.from(rawBase64, "base64");

    const formData = new FormData();
    formData.append("file", new Blob([bytes], { type: mimeType }), "listing-photo");
    formData.append("network", "public");

    const response = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Pinata API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const cid = data?.data?.cid;
    if (!cid) {
      throw new Error(`Unexpected Pinata response shape: ${JSON.stringify(data)}`);
    }

    return NextResponse.json({
      cid,
      // normalizeImageUrl() points this at Pinata's dedicated gateway —
      // see src/lib/assetMetadata.ts for why the dedicated domain is
      // used instead of the shared gateway.pinata.cloud.
      url: normalizeImageUrl(`ipfs://${cid}`),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
