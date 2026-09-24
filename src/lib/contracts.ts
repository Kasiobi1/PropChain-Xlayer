import { getActiveNetwork } from "./networkPreference";

// X Layer contract addresses, keyed by network. Testnet is the real,
// tested deployment (redeployed 2026-08-17). Mainnet has NOT been
// deployed yet — those addresses are placeholders until a real mainnet
// deployment happens, so reads against them will just come back empty,
// not wrong data.
export const CONTRACT_ADDRESSES_BY_NETWORK = {
  testnet: {
    assetNFT: "0xc12ED9316A66a8e405072621EEc6A7a7CE014cfC",
    marketplace: "0x127802Ac07B5F0C1E5E4E77D69526a647De45B87",
    escrowHold: "0x327d7046b9f3b6aDebffF6bc5c88625F3d1e3803",
  },
  mainnet: {
    // TODO: replace once AssetNFT/Marketplace/EscrowHold are actually
    // deployed to X Layer mainnet.
    assetNFT: "0x0000000000000000000000000000000000000000",
    marketplace: "0x0000000000000000000000000000000000000000",
    escrowHold: "0x0000000000000000000000000000000000000000",
  },
} as const;

export const XLAYER_TESTNET_CHAIN_ID = 1952;
export const XLAYER_MAINNET_CHAIN_ID = 196;

// Resolved once per module load against whichever network is active
// (see networkPreference.ts). On the server this is always "testnet" —
// server routes (mint-listing, update-revocation-fee) only ever operate
// against the deployed testnet contracts. On the client it reflects
// whatever the network toggle last set, since the toggle does a full
// page reload rather than a client-side nav, guaranteeing this module
// re-evaluates against the current choice.
const ACTIVE_NETWORK = getActiveNetwork();

export const CONTRACT_ADDRESSES = CONTRACT_ADDRESSES_BY_NETWORK[ACTIVE_NETWORK];
export const ACTIVE_CHAIN_ID: number =
  ACTIVE_NETWORK === "mainnet" ? XLAYER_MAINNET_CHAIN_ID : XLAYER_TESTNET_CHAIN_ID;
