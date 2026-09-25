# PropChain — X Layer

An AI-verified marketplace for real-world assets (RWAs) — houses, land, phones,
gadgets, cars — tokenized as NFTs on X Layer.

Built for the OKX / X Layer hackathon.

Peer-to-peer resale of physical assets has always run on trust and
screenshots. PropChain puts document verification, minting, and settlement
on-chain instead: a seller uploads proof of ownership, an AI pipeline reviews
it in real time, and only an approved listing can be minted and sold.

**This isn't legal proof of ownership.** It's AI-assisted document analysis
that makes a listing more trustworthy than an unverified peer-to-peer post,
with an on-chain record of what was checked and when.

## How it works

1. **List** — a seller uploads a document proving ownership (and optionally a
   selfie for a basic liveness check), plus real photos of the asset.
2. **Verify** — the document goes through an AI pipeline (Groq) that checks
   seller info, asset info, document consistency, and anomalies, and returns
   a verdict.
3. **Mint** — once approved, the asset mints as an NFT (`AssetNFT`), with
   images pinned to IPFS via Pinata and metadata stored on-chain.
4. **List for sale** — the seller lists the minted asset on the `Marketplace`
   contract.
5. **Buy** — a buyer purchases outright, or uses **Hold & Inspect**: lock
   funds in escrow, inspect the item in person, then confirm the purchase or
   walk away with a refund (minus a small fee) within the window.

## Tech stack

- **Next.js 16** (App Router), React 19, TypeScript, Tailwind v4
- **viem** for all on-chain reads/writes — no wagmi, no RainbowKit
- Custom **EIP-6963** wallet layer (`src/lib/walletConnect.ts`,
  `src/lib/walletProviders.ts`) — works with any injected wallet (OKX Wallet,
  MetaMask, etc.), with multi-wallet discovery
- **Groq** for AI document verification (vision extraction + verdict
  reasoning)
- **Pinata** for IPFS image pinning, with a gateway fallback chain

## Smart contracts (X Layer Testnet, chain ID 1952)

| Contract | Address | Purpose |
|---|---|---|
| `AssetNFT` | `0xc12ED9316A66a8e405072621EEc6A7a7CE014cfC` | ERC721 — mints verified assets as NFTs |
| `Marketplace` | `0x127802Ac07B5F0C1E5E4E77D69526a647De45B87` | Listings, buy-now, offers |
| `EscrowHold` | `0x327d7046b9f3b6aDebffF6bc5c88625F3d1e3803` | Hold & Inspect: lock funds, inspect, confirm or refund |

Native gas token is **OKB**. Mainnet (chain ID 196) is defined in the chain
config but has no contracts deployed — the network toggle shows a genuine
empty state on mainnet rather than demo data.

Minting is access-gated: `AssetNFT.mintAsset()` can only be called by the
address returned by `verifier()` on the deployed contract. The server-side
mint route signs with `VERIFIER_PRIVATE_KEY`; that key's address must match
`verifier()` or every mint reverts with `NotVerifier`.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for local dev, or 
try the live deployment at https://proplayer-mu.vercel.app.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VERIFIER_PRIVATE_KEY` | Yes | Signs server-side mints. Must match `verifier()` on `AssetNFT`. `0x` + 64 hex chars. Testnet-only wallet. |
| `PINATA_JWT` | Yes | Uploads listing photos to Pinata. |
| `GROQ_API_KEY` | Yes | Powers the AI document verification pipeline. |
| `VERIFICATION_TOKEN_SECRET` | Yes | HMAC-signs the verification token binding wallet + verdict, so a client can't fake an "approve" result. |
| `XLAYER_RPC_URL` | No | Server-side RPC. Defaults to `https://testrpc.xlayer.tech/terigon`. |
| `NEXT_PUBLIC_XLAYER_RPC_URL` | No | Overrides the browser-side RPC. Only set this to an endpoint you've confirmed responds — an unreachable override will make every on-chain read in the browser time out. |



## Project structure

```
src/
  app/
    list/               seller flow — upload, verify, mint, list
    admin/mint/          operator-only mint flow (client-side wallet write)
    listing/[tokenId]/   buy / offer / Hold & Inspect UI
    browse/              real + demo listings grid
    api/
      verify/            AI verification pipeline
      mint-listing/       server-side mint (uses VERIFIER_PRIVATE_KEY)
      upload-image/       Pinata image upload
      image-proxy/        gateway fetch with fallback chain
  lib/
    contracts.ts          contract addresses + active network
    xLayerChain.ts         viem chain definitions (testnet + mainnet)
    walletConnect.ts       wallet connection, public/wallet clients
    walletProviders.ts     EIP-6963 multi-wallet discovery
    assetMetadata.ts       on-chain metadata encode/decode, image URL handling
    useRealListings.ts     reads real on-chain listings
    verificationToken.ts   signs/verifies the AI verdict token
```

## Known limitations

- AI verification is a trust signal, not legal proof of ownership.
- The basic selfie/liveness check is a general vision-model face comparison,
  not dedicated anti-spoofing detection.
- `/browse`'s "Demo listings" are static sample data, shown on testnet only,
  unrelated to real chain state.
- Video transcript matching is not yet built.

## License

See `LICENSE`.
