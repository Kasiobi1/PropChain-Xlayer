"use client";

// Previously called @nimiq/mini-app-sdk's init() here as part of the
// Nimiq Pay Mini App migration. The X Layer version of PropChain doesn't
// use that SDK — wallet connection goes through the browser's injected
// EIP-1193 provider directly (see src/lib/walletConnect.ts), so there's
// no app-wide init step needed. This wrapper is kept as a no-op so
// layout.tsx doesn't need to change if a provider is ever needed again.
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
