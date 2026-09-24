export function SiteHeader() {
  return (
    <header className="border-b border-hairline-dark bg-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5 sm:px-6">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-2xl italic text-parchment">PropChain</span>
          <span className="hidden font-mono text-[11px] uppercase tracking-wider text-seal-gold-soft sm:inline">
            AI-Verified Registry
          </span>
        </div>

        <nav className="flex items-center justify-between gap-4 font-mono text-[12px] uppercase tracking-wide text-parchment/70 sm:justify-end sm:gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <span className="cursor-default text-seal-gold-soft">Browse</span>
            <span className="hidden cursor-default opacity-50 sm:inline">List an Asset</span>
            <span className="hidden cursor-default opacity-50 sm:inline">Swap</span>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-sm border border-seal-gold-soft/50 px-3 py-1.5 text-seal-gold-soft transition-colors hover:border-seal-gold-soft hover:bg-seal-gold-soft/10"
          >
            Connect Wallet
          </button>
        </nav>
      </div>
    </header>
  );
}
