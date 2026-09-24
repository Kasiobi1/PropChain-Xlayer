// Matches ProfileNames.sol (see that file's root-level copy in this
// project for the source — not yet deployed, so there's no address wired
// into contracts.ts yet). Once deployed, add its address there and this
// ABI is ready to use as-is.
export const PROFILE_NAMES_ABI = [
  {
    type: "function",
    name: "setName",
    stateMutability: "nonpayable",
    inputs: [{ name: "name_", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "nameOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "MAX_NAME_LENGTH",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "NameSet",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
    ],
  },
  { type: "error", name: "NameEmpty", inputs: [] },
  { type: "error", name: "NameTooLong", inputs: [] },
] as const;
