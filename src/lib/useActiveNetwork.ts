"use client";

import { useEffect, useState } from "react";
import { getActiveNetwork, type XLayerNetwork } from "./networkPreference";

/**
 * Kept in its own client-only file rather than inside
 * networkPreference.ts, because networkPreference.ts is also imported by
 * server API routes (via contracts.ts) — keeping it free of "use client"
 * and React hooks means there's no ambiguity about it being safe to
 * import from a route handler.
 *
 * Any piece of UI that claims to be reading from, or writing to, "X
 * Layer testnet" / "X Layer mainnet" should use this rather than
 * hardcoding one of those strings — otherwise the copy silently goes
 * stale the moment someone flips the toggle (exactly what happened the
 * first time this shipped: the toggle itself worked, but the hero copy
 * and page badge still said "testnet" unconditionally).
 *
 * Starts as "testnet" (the server-safe default) and corrects itself
 * after mount, matching NetworkToggle's own hydration-safe pattern.
 */
export function useActiveNetwork(): XLayerNetwork {
  const [network, setNetwork] = useState<XLayerNetwork>("testnet");
  useEffect(() => {
    setNetwork(getActiveNetwork());
  }, []);
  return network;
}
