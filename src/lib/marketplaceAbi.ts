// Hand-derived from contracts/Marketplace.sol (not from a build artifact,
// since this environment can't reach binaries.soliditylang.org to compile).
// Scoped to what the frontend currently calls. Expand this as more actions
// (buyNow, counterOffer, acceptOffer, etc.) get wired up — cross-check each
// addition against the actual .sol source, not from memory.
export const MARKETPLACE_ABI = [
  {
    type: "function",
    name: "listAsset",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assetId", type: "uint256" },
      { name: "floorPrice", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "buyNow",
    stateMutability: "payable",
    inputs: [{ name: "assetId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "makeOffer",
    stateMutability: "payable",
    inputs: [
      { name: "assetId", type: "uint256" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "offerId", type: "uint256" }],
  },
  {
    type: "function",
    name: "listings",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "floorPrice", type: "uint256" },
      { name: "currentPrice", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "getOffersForAsset",
    stateMutability: "view",
    inputs: [{ name: "assetId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "offers",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "buyer", type: "address" },
      { name: "assetId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "expiry", type: "uint64" },
      { name: "status", type: "uint8" },
      { name: "isSellerCounter", type: "bool" },
    ],
  },
  {
    type: "event",
    name: "OfferMade",
    inputs: [
      { name: "offerId", type: "uint256", indexed: true },
      { name: "assetId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AssetPurchased",
    inputs: [
      { name: "assetId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "ListingNotActive", inputs: [] },
  { type: "error", name: "InvalidPrice", inputs: [] },
  { type: "error", name: "InvalidExpiry", inputs: [] },
  { type: "error", name: "NotAssetOwner", inputs: [] },
  { type: "error", name: "IncorrectPaymentAmount", inputs: [] },
] as const;
