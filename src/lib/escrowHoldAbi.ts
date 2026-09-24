// Hand-derived from contracts/EscrowHold.sol — same approach as the other
// ABI files in this project (no compiled artifact available in this
// environment). Cross-check against the .sol source before extending.
export const ESCROW_HOLD_ABI = [
  {
    type: "function",
    name: "lockFunds",
    stateMutability: "payable",
    inputs: [
      { name: "assetId", type: "uint256" },
      { name: "seller", type: "address" },
      { name: "duration", type: "uint64" },
      { name: "price", type: "uint256" },
    ],
    outputs: [{ name: "holdId", type: "uint256" }],
  },
  {
    type: "function",
    name: "confirmPurchase",
    stateMutability: "nonpayable",
    inputs: [{ name: "holdId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "revokePurchase",
    stateMutability: "nonpayable",
    inputs: [{ name: "holdId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveExpiredHold",
    stateMutability: "nonpayable",
    inputs: [{ name: "holdId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "holds",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "buyer", type: "address" },
      { name: "assetId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "startedAt", type: "uint64" },
      { name: "expiresAt", type: "uint64" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "activeHoldByAsset",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "revocationFeeWei",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setRevocationFeeWei",
    stateMutability: "nonpayable",
    inputs: [{ name: "newFeeWei", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "RevocationFeeUpdated",
    inputs: [
      { name: "oldFeeWei", type: "uint256", indexed: false },
      { name: "newFeeWei", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FundsLocked",
    inputs: [
      { name: "holdId", type: "uint256", indexed: true },
      { name: "assetId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
    ],
  },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "InvalidDuration", inputs: [] },
  { type: "error", name: "IncorrectPaymentAmount", inputs: [] },
  { type: "error", name: "AssetAlreadyOnHold", inputs: [] },
  { type: "error", name: "NotAssetOwner", inputs: [] },
  { type: "error", name: "HoldNotActive", inputs: [] },
  { type: "error", name: "NotBuyer", inputs: [] },
  { type: "error", name: "NotExpiredYet", inputs: [] },
  { type: "error", name: "TransferFailed", inputs: [] },
  { type: "error", name: "FeeExceedsAmount", inputs: [] },
] as const;

export const HOLD_STATUS = ["None", "Active", "Confirmed", "Revoked", "Expired"] as const;
export const MIN_HOLD_DURATION_SECONDS = 86400; // 1 day
export const MAX_HOLD_DURATION_SECONDS = 604800; // 7 days
