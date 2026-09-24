"use client";

import { useEffect, useState } from "react";

// Deterministically derive a hue from a wallet address so every visit to
// the same profile generates the same colors — no backend needed for this.
function hueFromAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
export function generateAvatarDataUrl(address: string): string {
  const hue = hueFromAddress(address);
  const hue2 = (hue + 40) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue},70%,45%)" />
        <stop offset="100%" stop-color="hsl(${hue2},70%,35%)" />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#g)" />
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function generateBannerDataUrl(address: string): string {
  const hue = hueFromAddress(address);
  const hue2 = (hue + 60) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue},55%,14%)" />
        <stop offset="100%" stop-color="hsl(${hue2},55%,10%)" />
      </linearGradient>
    </defs>
    <rect width="800" height="200" fill="url(#bg)" />
    <circle cx="120" cy="40" r="90" fill="hsl(${hue},70%,45%)" opacity="0.18" />
    <circle cx="680" cy="170" r="110" fill="hsl(${hue2},70%,40%)" opacity="0.15" />
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Downscales and re-encodes an uploaded image as compressed JPEG before it
 * ever touches localStorage. Raw phone photos are commonly 2-5MB+ as base64
 * — storing that directly blew the ~5-10MB per-origin localStorage quota
 * (confirmed in testing: QuotaExceededError on a real banner upload).
 * Avatars/banners don't need original resolution, so this caps the longest
 * edge and re-encodes at moderate JPEG quality, typically landing well
 * under 200KB even for a large source photo.
 */
function downscaleImage(dataUrl: string, maxDimension: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Failed to load image for downscaling"));
    img.src = dataUrl;
  });
}

/**
 * Auto-generates avatar/banner images deterministically from the wallet
 * address, with an upload override stored in localStorage. No backend
 * profile database exists yet — this is a client-only, per-browser
 * override, not something that syncs across devices or is visible to other
 * users. A real implementation would store uploads server-side (e.g. IPFS,
 * matching the pattern already noted for listing photos) keyed by address.
 */
export function useProfileImages(address: string | undefined) {
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [bannerOverride, setBannerOverride] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setAvatarOverride(localStorage.getItem(`propchain:avatar:${address.toLowerCase()}`));
    setBannerOverride(localStorage.getItem(`propchain:banner:${address.toLowerCase()}`));
  }, [address]);

  async function setAvatar(dataUrl: string): Promise<string | null> {
    if (!address) return null;
    try {
      const compressed = await downscaleImage(dataUrl, 400, 0.85);
      localStorage.setItem(`propchain:avatar:${address.toLowerCase()}`, compressed);
      setAvatarOverride(compressed);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to save avatar.";
    }
  }

  async function setBanner(dataUrl: string): Promise<string | null> {
    if (!address) return null;
    try {
      const compressed = await downscaleImage(dataUrl, 1200, 0.8);
      localStorage.setItem(`propchain:banner:${address.toLowerCase()}`, compressed);
      setBannerOverride(compressed);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to save banner.";
    }
  }

  function resetAvatar() {
    if (!address) return;
    localStorage.removeItem(`propchain:avatar:${address.toLowerCase()}`);
    setAvatarOverride(null);
  }

  function resetBanner() {
    if (!address) return;
    localStorage.removeItem(`propchain:banner:${address.toLowerCase()}`);
    setBannerOverride(null);
  }

  const avatarUrl = avatarOverride ?? (address ? generateAvatarDataUrl(address) : null);
  const bannerUrl = bannerOverride ?? (address ? generateBannerDataUrl(address) : null);

  return {
    avatarUrl,
    bannerUrl,
    hasCustomAvatar: !!avatarOverride,
    hasCustomBanner: !!bannerOverride,
    setAvatar,
    setBanner,
    resetAvatar,
    resetBanner,
  };
}
