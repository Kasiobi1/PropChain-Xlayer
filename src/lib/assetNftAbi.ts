// Hand-derived from contracts/AssetNFT.sol (see marketplaceAbi.ts for why —
// this environment can't compile Solidity to get a build artifact). Scoped
// to what the admin mint page calls. Cross-check against the .sol source
// before adding more functions.
export const ASSET_NFT_ABI = [
  {
    type: "function",
    name: "mintAsset",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "assetType", type: "uint8" },
      { name: "supply", type: "uint256" },
      { name: "docHash", type: "bytes32" },
      { name: "verificationId", type: "bytes32" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    // Standard ERC721 function, inherited from OpenZeppelin, not custom to
    // AssetNFT — returns whatever URI was passed to mintAsset(), which is
    // now a real data: URI encoding name/description/location (see
    // assetMetadata.ts) rather than the old placeholder string.
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "verifier",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "nextTokenId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "assetData",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "assetType", type: "uint8" },
      { name: "originalOwner", type: "address" },
      { name: "supply", type: "uint256" },
      { name: "docHash", type: "bytes32" },
      { name: "verificationId", type: "bytes32" },
      { name: "mintedAt", type: "uint64" },
      { name: "docsRevoked", type: "bool" },
    ],
  },
  {
    type: "event",
    name: "AssetMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "assetType", type: "uint8", indexed: false },
      { name: "docHash", type: "bytes32", indexed: false },
      { name: "verificationId", type: "bytes32", indexed: false },
    ],
  },
  // Standard ERC-721 Transfer — part of the EIP-721 spec every ERC-721
  // contract emits, not something specific to this deployment that needs
  // verifying against source. Added so useWalletTransactions.ts can catch
  // sales that don't go through Marketplace's buyNow (e.g. an accepted
  // offer) without needing to know that function's exact signature —
  // whatever completes a sale still has to transfer the NFT, so this
  // event fires regardless of the mechanism.
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "EmptyDocHash", inputs: [] },
  { type: "error", name: "DocHashAlreadyUsed", inputs: [] },
  { type: "error", name: "EmptyURI", inputs: [] },
  { type: "error", name: "NotVerifier", inputs: [] },
] as const;

// Order MUST exactly match AssetNFT.sol's AssetType enum (House, Land,
// Phone, Gadget, Car, Other) — this is passed as a uint8, position matters.
export const ASSET_TYPE_ENUM = ["House", "Land", "Phone", "Gadget", "Car", "Other"] as const;

// keccak256("AssetMinted(uint256,address,uint8,bytes32,bytes32)") — used to
// find the RIGHT log when parsing a mint transaction's receipt. AssetNFT
// inherits ERC721, so every mint emits TWO logs at the contract's address:
// the standard Transfer(address,address,uint256) event AND this custom
// AssetMinted event. Filtering only by contract address (without also
// checking topics[0] against this signature) grabs whichever log comes
// first — which was Transfer, whose topics[1] is the zero "from" address,
// not a token ID. That bug caused a real failed listing transaction
// (ERC721NonexistentToken) after the frontend read "token #0" from a
// mint that was actually token #1 or higher. Always filter on this
// signature, not just the contract address, when parsing AssetMinted logs.
export const ASSET_MINTED_EVENT_SIGNATURE =
  "0x2bbe108cfaab591213de0643a6a6190617c041546e19e9aa8f83cff51369a612";
