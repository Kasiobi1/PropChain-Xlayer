"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useActiveNetwork } from "@/lib/useActiveNetwork";

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}

const SLIDES: Slide[] = [
  {
    eyebrow: "Top Value",
    title: "The highest-priced assets on PropChain right now",
    body: "From waterfront residences to prime commercial land — see what's trading at the top of the market.",
    cta: "View top listings",
    href: "/?sort=highest",
  },
  {
    eyebrow: "Just Listed",
    title: "New assets, verified and live",
    body: "Every new listing clears AI document and identity verification before it ever reaches the marketplace.",
    cta: "See what's new",
    href: "/?sort=newest",
  },
  {
    eyebrow: "Built on X Layer",
    title: "PropChain runs natively on X Layer",
    body: "Connect your wallet, verify, and trade real-world assets directly on X Layer testnet — no separate app, no extra install.",
    cta: "See how it works",
    href: "/about",
  },
  {
    eyebrow: "Pay Your Way",
    title: "Buy with OKB on X Layer",
    body: "PropChain settles on X Layer, secured by AI-verified listings — every asset checked before it reaches the marketplace.",
    cta: "Browse listings",
    href: "/browse",
  },
];

export function HeroSlideshow() {
  const [index, setIndex] = useState(0);
  const network = useActiveNetwork();

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  const slide = SLIDES[index];
  const slideBody =
    index === 2
      ? slide.body.replace("X Layer testnet", `X Layer ${network === "mainnet" ? "mainnet" : "testnet"}`)
      : slide.body;

  return (
    <div className="relative overflow-hidden rounded-xl border border-hairline bg-ink text-white">
      <div className="flex min-h-[220px] flex-col justify-center px-6 py-10 sm:px-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-seal-gold-soft">
          {slide.eyebrow}
        </p>
        <h2 className="mt-3 max-w-lg font-display text-2xl italic leading-tight sm:text-3xl">
          {slide.title}
        </h2>
        <p className="mt-3 max-w-md text-sm text-white/70">{slideBody}</p>
        <Link
          href={slide.href}
          className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-medium text-ink transition-opacity hover:opacity-85"
        >
          {slide.cta} →
        </Link>
      </div>

      <div className="absolute bottom-4 right-5 flex items-center gap-3">
        <span className="font-mono text-[11px] text-white/50">
          {index + 1}/{SLIDES.length}
        </span>
        <div className="flex gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-seal-gold-soft" : "w-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
