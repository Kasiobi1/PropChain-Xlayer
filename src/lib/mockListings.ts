// Mock data shaped to match what the real contracts will return once deployed:
// - AssetType enum matches AssetNFT.sol (House, Land, Phone, Gadget, Other)
// - floorPrice / currentPrice (BFP) match Marketplace.sol's Listing struct
// This file is the ONLY thing that needs to change when we wire up real
// on-chain reads later — every component consumes this shape.

export type AssetType = "House" | "Land" | "Phone" | "Gadget" | "Car" | "Other";

export interface Listing {
  tokenId: number;
  assetType: AssetType;
  name: string;
  location: string;
  seller: string; // wallet address, truncated for display
  sellerName: string; // display name for the agent/seller — wallets don't show names on-chain,
  // this would come from an off-chain profile record once accounts exist
  floorPriceEth: number;
  currentPriceEth: number; // BFP — may equal floorPriceEth if unchanged
  priceDirection: "up" | "down" | "unchanged";
  verified: true; // in this MVP, only verified assets are ever listed (AI-gated mint)
  verifiedDate: string;
  imageQuery: string; // used for representative photography on MOCK listings only
  imageUrl?: string; // deprecated single-image field, kept for backward compat — see imageUrls
  imageUrls?: string[]; // real IPFS-hosted photo URLs for REAL listings, if any were uploaded — see useRealListings.ts
  offerCount: number;
  docHashShort: string;
  docHashFull: string; // full keccak256 hash, as stored on-chain in AssetNFT.docHash
  supply: number;
  description: string;
  verificationId: string; // ties back to the AI verification pass, per AssetNFT.sol
  // Present on real listings minted as one of several identical units (see
  // assetMetadata.ts's batchId comment and /list's handleMint) — groups
  // sibling tokens for display. Always undefined for mock listings and any
  // real token minted before this existed.
  batchId?: string;
  // True for assets minted via /admin/mint (operator-confirmed
  // organizations) — see assetMetadata.ts's verifiedOrg comment. Always
  // false/undefined for mock listings.
  verifiedOrg?: boolean;
}

export const MOCK_LISTINGS: Listing[] = [
  {
    tokenId: 1,
    assetType: "Land",
    name: "0.5 Acre Plot — Lekki Phase 2 Extension",
    location: "Lekki, Lagos, Nigeria",
    seller: "0x8f2a...c19d",
    sellerName: "Adaeze Okonkwo",
    floorPriceEth: 4.2,
    currentPriceEth: 4.8,
    priceDirection: "up",
    verified: true,
    verifiedDate: "2026-07-28",
    imageQuery: "lagos lekki land plot aerial",
    offerCount: 3,
    docHashShort: "0x9e21…4ab7",
    docHashFull: "0x9e21a4f8c3b6d0127e5f9a1c4d8b7e3f0a2c5d9e1b4f7a0c3d6e9f2b5a8c1d4a4b7",
    supply: 1,
    description:
      "A 0.5 acre residential plot in the Lekki Phase 2 Extension corridor, within a gated, government-approved layout. Survey plan and Certificate of Occupancy verified against Lagos State land registry records prior to listing.",
    verificationId: "0x4a1f...b209",
  },
  {
    tokenId: 2,
    assetType: "House",
    name: "3-Bedroom Detached Duplex — Ikate",
    location: "Ikate, Lagos, Nigeria",
    seller: "0x3c91...7a2e",
    sellerName: "Tunde Bakare",
    floorPriceEth: 12.5,
    currentPriceEth: 12.5,
    priceDirection: "unchanged",
    verified: true,
    verifiedDate: "2026-08-01",
    imageQuery: "modern duplex house nigeria exterior",
    offerCount: 1,
    docHashShort: "0x11f8…c320",
    docHashFull: "0x11f8d2a7c9b4e0f61a3d8c5b2e9f7a0d4c1b8e5f2a9c6d3b0e7f4a1c8d5b2e9c320",
    supply: 1,
    description:
      "Newly built 3-bedroom detached duplex in a serviced Ikate estate. Includes BQ, fitted kitchen, and 24-hour estate security. Deed of Assignment and building approval verified prior to listing.",
    verificationId: "0x7b30...e814",
  },
  {
    tokenId: 3,
    assetType: "House",
    name: "4-Bedroom Terrace — Chevron Drive",
    location: "Lekki, Lagos, Nigeria",
    seller: "0x5b7d...e441",
    sellerName: "Chiamaka Eze",
    floorPriceEth: 9.8,
    currentPriceEth: 9.1,
    priceDirection: "down",
    verified: true,
    verifiedDate: "2026-07-19",
    imageQuery: "terrace house lagos nigeria street",
    offerCount: 5,
    docHashShort: "0x77ac…9e10",
    docHashFull: "0x77ac9b4e1f8d2c6a0b3e7f4d9c2a5b8e1f6d3a0c7b4e9f2d5a8c1b6e3f0a9d4c9e10",
    supply: 1,
    description:
      "4-bedroom terrace duplex on Chevron Drive, walking distance to the Lekki-Epe expressway. Recently reduced by seller — price reflects current market comparables in the Chevron/Lekki corridor.",
    verificationId: "0x2d95...a173",
  },
  {
    tokenId: 4,
    assetType: "Land",
    name: "1 Acre Commercial Plot — Epe Expressway",
    location: "Epe, Lagos, Nigeria",
    seller: "0x2d4f...b850",
    sellerName: "Segun Adeyemi",
    floorPriceEth: 2.1,
    currentPriceEth: 2.6,
    priceDirection: "up",
    verified: true,
    verifiedDate: "2026-08-05",
    imageQuery: "empty land plot road nigeria",
    offerCount: 2,
    docHashShort: "0x4c30…1fd2",
    docHashFull: "0x4c30f1e8a5b2d9c6e0f3a7b4d1c8e5f2a9b6d3c0e7f4a1b8d5c2e9f6a3b0d1fd2",
    supply: 1,
    description:
      "1 acre commercial-zoned plot fronting the Lekki-Epe expressway. Price has moved up since listing following announced road expansion in the corridor — reflected in the current BFP.",
    verificationId: "0x9f42...c650",
  },
  {
    tokenId: 5,
    assetType: "Phone",
    name: "iPhone 17 Pro Max — 512GB, Sealed",
    location: "Abuja, FCT, Nigeria",
    seller: "0x9a11...5c67",
    sellerName: "Fatima Bello",
    floorPriceEth: 0.42,
    currentPriceEth: 0.42,
    priceDirection: "unchanged",
    verified: true,
    verifiedDate: "2026-08-08",
    imageQuery: "iphone box sealed retail",
    offerCount: 0,
    docHashShort: "0xa910…772e",
    docHashFull: "0xa910e2d7c4b1f8a5e0d3c6b9f2a7e4d1c8b5f0a3d6c9e2b7f4a1d8c5b0e3f9772e",
    supply: 1,
    description:
      "Sealed, unopened iPhone 17 Pro Max, 512GB. Purchase receipt and IMEI verified against carrier records prior to listing.",
    verificationId: "0x1c84...f907",
  },
  {
    tokenId: 6,
    assetType: "Gadget",
    name: 'MacBook Pro 16" M5 Max — 2TB',
    location: "Port Harcourt, Rivers, Nigeria",
    seller: "0x6e88...9d13",
    sellerName: "Emeka Nwosu",
    floorPriceEth: 0.68,
    currentPriceEth: 0.61,
    priceDirection: "down",
    verified: true,
    verifiedDate: "2026-07-30",
    imageQuery: "macbook pro laptop closed silver",
    offerCount: 4,
    docHashShort: "0xd201…8b4f",
    docHashFull: "0xd201b8e5f2a9c6d3b0e7f4a1c8d5b2e9f6a3c0d7b4e1f8a5c2d9b6e3f0a7c18b4f",
    supply: 1,
    description:
      "MacBook Pro 16-inch, M5 Max, 2TB SSD. Purchased new 3 months ago, AppleCare+ active. Original receipt and serial number verified prior to listing.",
    verificationId: "0x6e17...d382",
  },
  {
    tokenId: 7,
    assetType: "House",
    name: "5-Bedroom Fully Detached — Banana Island",
    location: "Ikoyi, Lagos, Nigeria",
    seller: "0x1f60...a92c",
    sellerName: "Ifeoma Chukwu",
    floorPriceEth: 48.0,
    currentPriceEth: 52.0,
    priceDirection: "up",
    verified: true,
    verifiedDate: "2026-06-22",
    imageQuery: "luxury mansion lagos nigeria gate",
    offerCount: 7,
    docHashShort: "0x3ee5…c001",
    docHashFull: "0x3ee5c8b1e4f7a2d9c6b3e0f8a5d1c4b7e2f9a6d3c0b8e5f1a4d7c2b9e6f3a0dc001",
    supply: 1,
    description:
      "5-bedroom fully detached residence on Banana Island, waterfront access, private jetty. Certificate of Occupancy and title documents independently verified prior to listing — one of the highest-value assets currently on PropChain.",
    verificationId: "0x8a53...b219",
  },
  {
    tokenId: 8,
    assetType: "Land",
    name: "Half Plot — Sangotedo Residential Zone",
    location: "Sangotedo, Lagos, Nigeria",
    seller: "0x7bc2...f038",
    sellerName: "Kunle Afolabi",
    floorPriceEth: 1.4,
    currentPriceEth: 1.4,
    priceDirection: "unchanged",
    verified: true,
    verifiedDate: "2026-08-03",
    imageQuery: "residential land plot survey nigeria",
    offerCount: 1,
    docHashShort: "0x66b1…0e9a",
    docHashFull: "0x66b10e4c7b2f9a5d8e1c4b0f7a3d6e9c2b5f8a1d4c7e0b3f6a9d2c5e8b1f40e9a",
    supply: 1,
    description:
      "Half-plot residential land in the Sangotedo growth corridor, dry land with beacons confirmed on-site. Survey and Deed of Assignment verified prior to listing.",
    verificationId: "0x5f26...a481",
  },
];

export interface Offer {
  offerId: number;
  buyer: string;
  amountEth: number;
  status: "Pending" | "Countered" | "Accepted" | "Rejected" | "Withdrawn" | "Expired";
  expiresAt: string;
  isSellerCounter: boolean;
}

// Mock offers per tokenId — mirrors Marketplace.sol's Offer struct and offersByAsset mapping.
export const MOCK_OFFERS: Record<number, Offer[]> = {
  1: [
    { offerId: 101, buyer: "0x2f81...9c33", amountEth: 4.5, status: "Pending", expiresAt: "2026-08-14", isSellerCounter: false },
    { offerId: 102, buyer: "0x77bd...1120", amountEth: 4.65, status: "Countered", expiresAt: "2026-08-13", isSellerCounter: true },
    { offerId: 103, buyer: "0x9a02...ee41", amountEth: 4.2, status: "Pending", expiresAt: "2026-08-15", isSellerCounter: false },
  ],
  3: [
    { offerId: 201, buyer: "0x5511...b820", amountEth: 8.7, status: "Pending", expiresAt: "2026-08-16", isSellerCounter: false },
    { offerId: 202, buyer: "0x0af3...7c19", amountEth: 8.9, status: "Pending", expiresAt: "2026-08-12", isSellerCounter: false },
  ],
  6: [
    { offerId: 301, buyer: "0x44de...2a01", amountEth: 0.58, status: "Pending", expiresAt: "2026-08-13", isSellerCounter: false },
  ],
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  House: "Houses",
  Land: "Land",
  Phone: "Phones",
  Gadget: "Gadgets",
  Car: "Cars",
  Other: "Other",
};
