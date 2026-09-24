import type { AssetType } from "./mockListings";

export interface ListingRequirement {
  documentLabel: string;
  documentHint: string;
  extraFieldLabel: string | null; // an asset-specific detail field, or null if none needed
  extraFieldPlaceholder: string;
}

// Drives the dynamic form on /list — which document to ask for and what
// asset-specific detail to collect varies by type. This is the document
// side only; liveness/selfie verification (planned, not built yet) would
// be a separate step applied uniformly regardless of asset type.
export const LISTING_REQUIREMENTS: Record<AssetType, ListingRequirement> = {
  House: {
    documentLabel: "Deed or Certificate of Occupancy",
    documentHint:
      "Upload a clear photo of your Certificate of Occupancy, Deed of Assignment, or equivalent title document showing your name and the property address.",
    extraFieldLabel: "Property address",
    extraFieldPlaceholder: "e.g. 12 Admiralty Way, Lekki Phase 1, Lagos",
  },
  Land: {
    documentLabel: "Certificate of Occupancy or survey plan",
    documentHint:
      "Upload a clear photo of your Certificate of Occupancy, survey plan, or Deed of Assignment showing your name and the land's location.",
    extraFieldLabel: "Land location / plot description",
    extraFieldPlaceholder: "e.g. 0.5 acre plot, Lekki Phase 2 Extension",
  },
  Car: {
    documentLabel: "Vehicle title or registration document",
    documentHint:
      "Upload a clear photo of your vehicle title, registration certificate, or proof of purchase showing your name and the vehicle's details.",
    extraFieldLabel: "Make, model, and VIN",
    extraFieldPlaceholder: "e.g. 2021 Toyota Camry, VIN 4T1BF1FK5CU123456",
  },
  Phone: {
    documentLabel: "Purchase receipt",
    documentHint:
      "Upload a clear photo of your purchase receipt or invoice showing the device and, ideally, its IMEI/serial number.",
    extraFieldLabel: "IMEI or serial number",
    extraFieldPlaceholder: "e.g. 358240051111110",
  },
  Gadget: {
    documentLabel: "Purchase receipt",
    documentHint:
      "Upload a clear photo of your purchase receipt or invoice showing the device and, ideally, its serial number.",
    extraFieldLabel: "Serial number",
    extraFieldPlaceholder: "e.g. C02XG2JMJGH6",
  },
  Other: {
    documentLabel: "Proof of ownership",
    documentHint: "Upload a clear photo of any document that proves you own this asset.",
    extraFieldLabel: null,
    extraFieldPlaceholder: "",
  },
};
