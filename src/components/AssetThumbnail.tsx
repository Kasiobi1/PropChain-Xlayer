"use client";

import { useEffect, useState } from "react";
import type { AssetType } from "@/lib/mockListings";
import { IPFS_GATEWAY_HOSTS } from "@/lib/assetMetadata";

interface AssetThumbnailProps {
  assetType: AssetType;
  seed: number;
  imageUrl?: string; // real IPFS photo URL — takes priority over the illustration if present
}

const proxied = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`;

/**
 * Builds the ordered list of URLs to try for one photo.
 *
 * THE BUG THIS FIXES: this function used to pull the CID out of the
 * uploaded URL and then throw the host away, rebuilding the request
 * against a hardcoded list that led with ipfs.ninja. After the upload
 * side moved to Pinata, that meant every photo — freshly uploaded and
 * correctly pinned — was requested from a gateway that no longer
 * exists, then from public gateways that don't have the bytes and hang
 * or 429 rather than failing fast. Net effect in the UI: a permanently
 * blank image area, with no error, on listings whose photo uploaded
 * fine.
 *
 * The host the image was actually uploaded to is now tried first, both
 * directly and proxied, before falling back to public gateways.
 */
function getGatewayVariants(url: string): string[] {
  const match = url.match(/^https:\/\/([^/]+)\/ipfs\/(.+)$/);
  if (!match) return [url]; // not a recognized IPFS gateway URL — use as-is, unproxied

  const [, originHost, path] = match;

  return [
    // 1. Straight at the gateway the image is actually pinned on.
    url,
    // 2. Same gateway, but server-side — in case a browser
    //    referrer/origin restriction blanks an <img> even though the
    //    gateway serves the URL fine when opened directly.
    proxied(url),
    // 3. Public-network fallbacks, in case Pinata itself is down.
    ...IPFS_GATEWAY_HOSTS.filter((host) => host !== originHost).map((host) =>
      proxied(`https://${host}/ipfs/${path}`)
    ),
  ];
}

// Subtle dark-surface shades so thumbnails sit flush with the surrounding
// dark card instead of punching a bright hole in it.
const BG_SHADES = ["#1c1c1c", "#191919", "#1e1e1e", "#1a1a1a"];
const LINE = "#e8e8e8"; // light stroke/fill so line art reads against dark backgrounds
const LINE_DIM = "#8a8a8a"; // secondary details

/**
 * Detailed line-art illustrations standing in for real listing photography.
 * NOT AI-generated photos — no image generation tool is available in this
 * environment, and real listing/stock photos carry copyright risk, so these
 * are original vector illustrations built directly in the component. Swap
 * for real seller-uploaded photos (via the IPFS storage layer) or licensed/
 * generated imagery later — see spec 6.6.
 */
function HouseArt() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full">
      <rect x="0" y="170" width="320" height="70" fill="#242424" />
      <rect x="70" y="110" width="180" height="100" fill="none" stroke={LINE} strokeWidth="2" />
      <path d="M55 115 L160 55 L265 115 Z" fill={LINE} />
      <rect x="145" y="150" width="30" height="60" fill={LINE} />
      <rect x="90" y="135" width="30" height="30" fill="none" stroke={LINE} strokeWidth="2" />
      <rect x="200" y="135" width="30" height="30" fill="none" stroke={LINE} strokeWidth="2" />
      <line x1="105" y1="135" x2="105" y2="165" stroke={LINE} strokeWidth="1.5" />
      <line x1="90" y1="150" x2="120" y2="150" stroke={LINE} strokeWidth="1.5" />
      <line x1="215" y1="135" x2="215" y2="165" stroke={LINE} strokeWidth="1.5" />
      <line x1="200" y1="150" x2="230" y2="150" stroke={LINE} strokeWidth="1.5" />
      <rect x="205" y="70" width="16" height="35" fill={LINE} />
      <path d="M160 210 L160 235" stroke={LINE_DIM} strokeWidth="2" strokeDasharray="4 5" />
    </svg>
  );
}

function LandArt() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full">
      <rect x="0" y="150" width="320" height="90" fill="#242424" />
      <g stroke={LINE} strokeWidth="1.5" fill="none">
        <path d="M40 200 L100 90 L240 90 L280 200 Z" />
        <line x1="100" y1="90" x2="100" y2="200" strokeDasharray="3 4" opacity="0.5" />
        <line x1="240" y1="90" x2="240" y2="200" strokeDasharray="3 4" opacity="0.5" />
        <line x1="160" y1="90" x2="160" y2="200" strokeDasharray="3 4" opacity="0.5" />
      </g>
      <circle cx="40" cy="200" r="4" fill={LINE} />
      <circle cx="100" cy="90" r="4" fill={LINE} />
      <circle cx="240" cy="90" r="4" fill={LINE} />
      <circle cx="280" cy="200" r="4" fill={LINE} />
      <circle cx="270" cy="130" r="14" fill={LINE} opacity="0.85" />
      <line x1="270" y1="144" x2="270" y2="160" stroke={LINE} strokeWidth="2" />
    </svg>
  );
}

function PhoneArt() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full">
      <rect x="130" y="35" width="60" height="170" rx="10" fill="none" stroke={LINE} strokeWidth="2.5" />
      <rect x="138" y="48" width="44" height="130" fill={LINE} opacity="0.08" />
      <circle cx="160" cy="192" r="4" fill={LINE} />
      <rect x="150" y="42" width="20" height="3" rx="1.5" fill={LINE} opacity="0.6" />
    </svg>
  );
}

function GadgetArt() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full">
      <rect x="90" y="70" width="140" height="90" rx="4" fill="none" stroke={LINE} strokeWidth="2.5" />
      <rect x="98" y="78" width="124" height="74" fill={LINE} opacity="0.08" />
      <path d="M75 165 L245 165 L235 178 L85 178 Z" fill={LINE} />
    </svg>
  );
}

function CarArt() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full">
      <rect x="0" y="175" width="320" height="65" fill="#242424" />
      <path
        d="M55 170 L75 125 Q80 115 92 115 L130 115 L145 95 Q150 88 160 88 L200 88 Q210 88 216 96 L230 115 L248 115 Q262 115 268 128 L275 170 Z"
        fill="none"
        stroke={LINE}
        strokeWidth="2.5"
      />
      <path d="M145 95 L138 115 L222 115 L216 96 Z" fill={LINE} opacity="0.1" />
      <line x1="55" y1="170" x2="275" y2="170" stroke={LINE} strokeWidth="2.5" />
      <circle cx="100" cy="172" r="18" fill="#1c1c1c" stroke={LINE} strokeWidth="2.5" />
      <circle cx="100" cy="172" r="6" fill={LINE} />
      <circle cx="235" cy="172" r="18" fill="#1c1c1c" stroke={LINE} strokeWidth="2.5" />
      <circle cx="235" cy="172" r="6" fill={LINE} />
      <line x1="150" y1="102" x2="185" y2="102" stroke={LINE} strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

const ART: Record<AssetType, () => React.JSX.Element> = {
  House: HouseArt,
  Land: LandArt,
  Phone: PhoneArt,
  Gadget: GadgetArt,
  Car: CarArt,
  Other: HouseArt,
};

export function AssetThumbnail({ assetType, seed, imageUrl }: AssetThumbnailProps) {
  const Art = ART[assetType];
  const bg = BG_SHADES[seed % BG_SHADES.length];

  // Tries each gateway variant in order on failure — a rate limit or dead
  // gateway on attempt 1 moves to attempt 2 instead of giving up straight
  // to the illustration. Only falls back to the illustration once every
  // variant has failed. Resets whenever imageUrl changes, so paging
  // through a multi-photo carousel re-attempts each photo fresh instead of
  // getting stuck on a prior photo's failure count.
  const variants = imageUrl ? getGatewayVariants(imageUrl) : [];
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [imageUrl]);

  const allFailed = variants.length > 0 && attempt >= variants.length;

  if (imageUrl && !allFailed) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden" style={{ backgroundColor: bg }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={variants[attempt]}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setAttempt((a) => a + 1)}
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center" style={{ backgroundColor: bg }}>
      <div className="h-full w-full p-4">
        <Art />
      </div>
    </div>
  );
}
