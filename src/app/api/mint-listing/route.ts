import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, keccak256, toBytes, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { xLayerTestnet } from "@/lib/xLayerChain";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { ASSET_NFT_ABI, ASSET_TYPE_ENUM, ASSET_MINTED_EVENT_SIGNATURE } from "@/lib/assetNftAbi";
import { encodeMetadataDataUri } from "@/lib/assetMetadata";
import { verifyVerificationToken } from "@/lib/verificationToken";

// Server-side mint: mintAsset() on AssetNFT.sol is verifier-gated, so a
// seller's own wallet can never call it directly (see the .env.local
// comment on VERIFIER_PRIVATE_KEY for why). This route signs and submits
// the mint transaction using the verifier wallet, but mints the NFT TO the
// seller's connected wallet address — they end up owning it even though
// their wallet never signed the mint tx itself.
//
// SECURITY FIX (previously a real gap): this endpoint used to trust a raw
// `{"verdict": "approve"}` field sent straight from the browser — anyone
// could fake that via curl/devtools and mint without real AI approval. It
// now requires a `verificationToken` issued by /api/verify and independently
// re-verifies it here (HMAC signature, expiry, wallet match, verdict) via
// verifyVerificationToken() — see src/lib/verificationToken.ts. The client
// no longer gets to assert its own verdict at all.

const VERIFIER_PRIVATE_KEY = process.env.VERIFIER_PRIVATE_KEY as `0x${string}` | undefined;
const RPC_URL = process.env.XLAYER_RPC_URL || "https://testrpc.xlayer.tech/terigon";

interface MintListingBody {
  toAddress: string;
  assetType: string; // must match ASSET_TYPE_ENUM
  supply: number;
  sellerStatedName: string;
  assetDescription: string;
  assetLocation?: string;
  assetName?: string;
  imageUrl?: string; // legacy single-image field, kept for backward compat
  imageUrls?: string[]; // real IPFS photo URLs, already uploaded via /api/upload-image before this call
  metadataURI?: string; // if not provided, one is built from the fields above
  // Present when this mint is one unit of a multi-unit listing (see /list's
  // handleMint) — every unit in the same batch gets the same batchId so the
  // frontend can group them and count how many are still Active.
  batchId?: string;
  // Signed by /api/verify, bound to toAddress. Replaces the old raw
  // `verdict` field a client could fake directly.
  verificationToken: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!VERIFIER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "VERIFIER_PRIVATE_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const body: MintListingBody = await req.json();

    if (!body.toAddress || !isAddress(body.toAddress)) {
      return NextResponse.json({ error: "A valid toAddress is required." }, { status: 400 });
    }
    const tokenCheck = verifyVerificationToken(body.verificationToken, body.toAddress);
    if (!tokenCheck.valid) {
      return NextResponse.json(
        { error: `Cannot mint — ${tokenCheck.error ?? "verification token was invalid."}` },
        { status: 403 }
      );
    }

    const typeIndex = ASSET_TYPE_ENUM.indexOf(body.assetType as (typeof ASSET_TYPE_ENUM)[number]);
    if (typeIndex === -1) {
      return NextResponse.json({ error: `Unknown assetType: ${body.assetType}` }, { status: 400 });
    }

    const account = privateKeyToAccount(VERIFIER_PRIVATE_KEY);
    const transport = http(RPC_URL);

    const walletClient = createWalletClient({ account, chain: xLayerTestnet, transport });
    const publicClient = createPublicClient({ chain: xLayerTestnet, transport });

    // docHash needs to be unique per submission — hashing the seller's
    // stated name + description + a timestamp, same pattern as the admin
    // mint page, so repeated testing doesn't collide with AssetNFT's
    // permanent docHash-reuse block.
    const docHash = keccak256(
      toBytes(`${body.sellerStatedName}-${body.assetDescription}-${Date.now()}`)
    );
    const verificationId = keccak256(toBytes(`verify-${body.toAddress}-${Date.now()}`));
    const metadataURI =
      body.metadataURI ??
      encodeMetadataDataUri({
        name: body.assetName || `${body.assetType} listed by ${body.sellerStatedName}`,
        description: body.assetDescription,
        location: body.assetLocation || "Not specified",
        assetType: body.assetType,
        imageUrl: body.imageUrl,
        imageUrls: body.imageUrls,
        batchId: body.batchId,
        attributes: [
          { trait_type: "Asset Type", value: body.assetType },
          { trait_type: "Location", value: body.assetLocation || "Not specified" },
        ],
      });

    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESSES.assetNFT,
      abi: ASSET_NFT_ABI,
      functionName: "mintAsset",
      args: [
        body.toAddress as `0x${string}`,
        typeIndex,
        BigInt(body.supply || 1),
        docHash,
        verificationId,
        metadataURI,
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Pull the minted tokenId from the AssetMinted event log. Must match
    // on the event SIGNATURE (topics[0]), not just the contract address —
    // AssetNFT also emits the standard ERC721 Transfer event at the same
    // address on every mint, and grabbing that one instead reads its
    // "from" address (0x000...0) as if it were the token ID, which then
    // causes the subsequent listAsset() call to fail with
    // ERC721NonexistentToken since that token was never actually minted.
    // See ASSET_MINTED_EVENT_SIGNATURE's comment in assetNftAbi.ts.
    const mintedLog = receipt.logs.find(
      (log) =>
        log.address.toLowerCase() === CONTRACT_ADDRESSES.assetNFT.toLowerCase() &&
        log.topics[0]?.toLowerCase() === ASSET_MINTED_EVENT_SIGNATURE.toLowerCase()
    );
    const tokenId = mintedLog?.topics[1] ? BigInt(mintedLog.topics[1]).toString() : null;

    return NextResponse.json({
      success: true,
      transactionHash: hash,
      tokenId,
      mintedTo: body.toAddress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mint failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
