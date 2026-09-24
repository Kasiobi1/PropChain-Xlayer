// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title ProfileNames
/// @notice Lets any wallet set a permanent display name for itself, so
/// PropChain listings and search can show a real name instead of a
/// truncated address. Deliberately standalone — it doesn't touch
/// AssetNFT.sol or Marketplace.sol at all, so it can be deployed and wired
/// in independently without redeploying anything else or migrating any
/// existing token.
///
/// "Permanent" here means: once set, a name stays on-chain forever and can
/// only ever be changed by the same wallet that set it — there is no
/// admin override, no deletion, and no expiry. Anyone can read anyone's
/// name; only an address can write its own.
contract ProfileNames {
    mapping(address => string) private _names;

    event NameSet(address indexed account, string name);

    error NameEmpty();
    error NameTooLong();

    /// @notice Max length in bytes, not characters — multi-byte UTF-8
    /// characters (accents, non-Latin scripts, emoji) cost more than 1
    /// byte each, so very short strings in some scripts could hit this
    /// sooner than 32 visible characters. 32 bytes covers the vast
    /// majority of real display names while keeping gas cost low.
    uint256 public constant MAX_NAME_LENGTH = 32;

    /// @notice Sets (or changes) the caller's own display name. Calling
    /// this again overwrites the previous name — there's no history kept
    /// on-chain, only whatever the most recent NameSet event log shows.
    function setName(string calldata name_) external {
        bytes memory nameBytes = bytes(name_);
        if (nameBytes.length == 0) revert NameEmpty();
        if (nameBytes.length > MAX_NAME_LENGTH) revert NameTooLong();
        _names[msg.sender] = name_;
        emit NameSet(msg.sender, name_);
    }

    /// @notice Reads any address's display name. Returns an empty string
    /// if that address has never called setName — callers should treat an
    /// empty string as "no name set" and fall back to a truncated address,
    /// same as PropChain already does everywhere seller names show up.
    function nameOf(address account) external view returns (string memory) {
        return _names[account];
    }
}
