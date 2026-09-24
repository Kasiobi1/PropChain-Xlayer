"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV_ITEMS = [
  {
    label: "Search",
    href: "/browse#search",
    icon: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35",
  },
  { label: "Browse", href: "/browse", icon: "M4 6h16M4 12h16M4 18h7" },
  { label: "Houses", href: "/browse?type=House", icon: "M4 12l8-7 8 7M6 10.5V19h4v-5h4v5h4v-8.5" },
  { label: "Land", href: "/browse?type=Land", icon: "M3 18h18M5 18V9l4-3 4 3v9M13 18v-6l4-2 4 2v6" },
  {
    label: "Phones & Gadgets",
    href: "/browse?type=Phone",
    icon: "M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z",
  },
  {
    label: "Cars",
    href: "/browse?type=Car",
    icon: "M5 17h14M6 17l1.5-6a2 2 0 011.9-1.5h5.2a2 2 0 011.9 1.5L18 17M5 17a2 2 0 104 0M15 17a2 2 0 104 0",
  },
  { label: "Swap", href: "/swap", icon: "M7 10l-3 3 3 3M4 13h16M17 4l3 3-3 3M20 7H4" },
  { label: "Earn", href: "/earn", icon: "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
];

const SECONDARY_ITEMS = [
  { label: "Profile", href: "/profile", icon: "M12 12a5 5 0 100-10 5 5 0 000 10zM3 21a9 9 0 0118 0" },
  { label: "List an Asset", href: "/list", icon: "M12 5v14M5 12h14" },
  {
    label: "Wallet",
    href: "/wallet",
    icon: "M3 7a2 2 0 012-2h12a2 2 0 012 2v1h1a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM16 13h2",
  },
];

function NavRow({
  item,
  isActive,
}: {
  item: { label: string; href: string; icon: string };
  isActive: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={item.label}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
        isActive ? "bg-white text-black font-medium" : "text-white/70 hover:bg-ink-raised hover:text-white"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="overflow-hidden whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {item.label}
      </span>
    </Link>
  );
}

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentType = searchParams.get("type");

  return (
    <aside
      className="group hidden shrink-0 flex-col overflow-hidden border-r border-hairline-dark bg-ink px-3 py-5 transition-[width] duration-200 ease-out lg:flex lg:w-[76px] lg:hover:w-52"
    >
      <Link href="/" className="flex items-center gap-2 px-3 pb-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-seal-gold text-seal-gold">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="overflow-hidden whitespace-nowrap font-display text-xl italic text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          PropChain
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const [itemPath, itemQuery] = item.href.split("?");
          const itemType = itemQuery ? new URLSearchParams(itemQuery).get("type") : null;
          const isActive = pathname === itemPath && currentType === itemType;
          return <NavRow key={item.label} item={item} isActive={isActive} />;
        })}

        <div className="my-3 border-t border-hairline-dark" />

        {SECONDARY_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            title={item.label}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white/50 transition-colors hover:bg-ink-raised hover:text-white/80"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[18px] w-[18px] shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="overflow-hidden whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-lg border border-hairline-dark bg-ink-raised px-3 py-3">
        <div className="flex items-center gap-1.5 text-seal-gold-soft">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="overflow-hidden whitespace-nowrap text-[11px] font-mono uppercase tracking-wide opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            AI-Verified
          </span>
        </div>
        <p className="mt-1.5 overflow-hidden whitespace-nowrap text-[11px] leading-relaxed text-white/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          Every listing passes document + identity review before it&apos;s minted.
        </p>
      </div>
    </aside>
  );
}


export function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarInner />
    </Suspense>
  );
}
