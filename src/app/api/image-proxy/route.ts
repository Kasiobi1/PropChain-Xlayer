import { NextRequest, NextResponse } from "next/server";
import { IPFS_GATEWAY_HOSTS } from "@/lib/assetMetadata";

// Real fix for a real bug found via testing: pasting a gateway URL
// directly into a browser tab loads fine, but the exact same URL used
// as an <img src> embedded on this site renders blank — a referrer/
// origin restriction on some gateways, not a data or URL-format
// problem. This route re-fetches the image server-side and streams it
// back, so the browser only ever talks to our own origin.
//
// ALLOWED_HOSTS is a strict allowlist, not a general-purpose proxy —
// this only ever fetches from the same IPFS gateways AssetThumbnail
// already tries directly (src/components/AssetThumbnail.tsx), so it
// can't be used to fetch arbitrary attacker-supplied URLs. Sourced from
// the shared list in lib/assetMetadata rather than duplicated here, so
// a gateway added to AssetThumbnail can't end up rejected here with
// "Host not allowed" because this list was never updated alongside it.
const ALLOWED_HOSTS = IPFS_GATEWAY_HOSTS;

// A gateway that doesn't have the bytes tends to hang rather than 404 —
// it keeps searching the network. Without a timeout the proxy request
// stays pending indefinitely, the <img> never fires onError, and the
// fallback chain in AssetThumbnail never advances: the user just sees
// an empty image area forever. Failing fast here is what makes the
// retry chain actually work.
const FETCH_TIMEOUT_MS = 10_000;

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url parameter." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url parameter." }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed." }, { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "image/*,*/*" },
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream gateway returned ${upstream.status}.` },
        { status: upstream.status }
      );
    }
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        // Images are content-addressed (the CID is a hash of the bytes) —
        // this exact URL can never point to different content, so caching
        // aggressively is safe.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy fetch failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
