export type XLayerNetwork = "testnet" | "mainnet";

const STORAGE_KEY = "propchain-network";

// Server code (API routes) has no localStorage and always gets
// "testnet" back — intentional, since the verifier wallet only operates
// against the deployed testnet contracts until a real mainnet
// deployment exists. Only client-side reads/wallet connections are
// affected by the toggle.
export function getActiveNetwork(): XLayerNetwork {
  if (typeof window === "undefined") return "testnet";
  return window.localStorage.getItem(STORAGE_KEY) === "mainnet" ? "mainnet" : "testnet";
}

export function setActiveNetwork(network: XLayerNetwork) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, network);
}
