import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

// Font loading was previously via next/font/google (Fraunces, Inter, IBM
// Plex Mono), but Google's font CDN started returning 404s for the exact
// cached font-file URLs Next.js's optimizer generated, crashing the dev
// server ("Module not found: @vercel/turbopack-next/internal/font/google/font").
// Rather than depend on a live fetch to Google at build/dev time, this now
// relies entirely on the system font fallback stacks already defined in
// globals.css (Georgia/serif for display, ui-sans-serif/system-ui for body,
// ui-monospace for mono) — no network dependency, no external font files.
// If real branded fonts are wanted later, self-host the .woff2 files instead
// of fetching from Google at request time.

export const metadata: Metadata = {
  title: "PropChain — AI-Verified Real-World Assets",
  description:
    "Browse AI-verified real-world assets — houses, land, and gadgets — tokenized and traded on X Layer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-ink text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

