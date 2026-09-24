import Link from "next/link";

const LINKS = [
  { label: "What is PropChain?", href: "/about" },
  { label: "How to list a prop", href: "/guides/list-an-asset" },
  { label: "How to buy a prop", href: "/guides/buy-an-asset" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline-dark px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-text-secondary transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <p className="font-mono text-[11px] uppercase tracking-wide text-text-secondary">
          Built for X Layer
        </p>
      </div>
    </footer>
  );
}
