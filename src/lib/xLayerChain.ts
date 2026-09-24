import { defineChain } from "viem";

// X Layer testnet and mainnet aren't in viem's built-in chain list, so
// both are defined here from OKX's published network details
// (docs.xlayer docs / rpc.xlayer.tech).
//
// Block explorer intentionally omitted rather than guessed — fill in
// OKLink's X Layer testnet explorer URL here once confirmed, so wallet
// prompts and tx links can point at it.
export const xLayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testrpc.xlayer.tech/terigon"] },
  },
  testnet: true,
});

export const xLayerMainnet = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: { name: "OKX Explorer", url: "https://www.okx.com/web3/explorer/xlayer" },
  },
  testnet: false,
});

