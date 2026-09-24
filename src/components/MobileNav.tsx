"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV_ITEMS = [
  { label: "Browse", href: "/browse" },
  { label: "Houses", href: "/browse?type=House" },
  { label: "Land", href: "/browse?type=Land" },
  { label: "Phones & Gadgets", href: "/browse?type=Phone" },
  { label: "Cars", href: "/browse?type=Car" },
  { label: "Swap", href: "/swap" },
  { label: "Earn", href: "/earn" },
];

const SECONDARY_ITEMS = [
  { label: "Profile", href: "/profile" },
  { label: "List an Asset", href: "/list" },
  { label: "Wallet", href: "/wallet" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentType = searchParams.get("type");

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors hover:bg-ink-raised"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />

          {/* drawer */}
          <div className="relative flex h-full w-72 flex-col overflow-y-auto border-r border-hairline-dark bg-ink px-4 py-5">
            <div className="flex items-center justify-between pb-6">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="font-display text-xl italic text-white"
              >
                PropChain
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-ink-raised hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => {
                const [itemPath, itemQuery] = item.href.split("?");
                const itemType = itemQuery ? new URLSearchParams(itemQuery).get("type") : null;
                const isActive = pathname === itemPath && currentType === itemType;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      isActive ? "bg-white font-medium text-black" : "text-white/70 hover:bg-ink-raised hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="my-3 border-t border-hairline-dark" />

              {SECONDARY_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-white/50 transition-colors hover:bg-ink-raised hover:text-white/80"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
