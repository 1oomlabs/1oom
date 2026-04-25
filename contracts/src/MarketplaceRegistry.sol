// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MarketplaceRegistry
/// @notice Onchain registry for workflow listings. Agents register workflow
///         content hashes here so other agents can discover them trustlessly.
/// @dev    Integration point for the Gensyn AXL track - agents communicate
///         through this registry instead of a central coordinator.
contract MarketplaceRegistry {
    struct Listing {
        address author;
        bytes32 contentHash; // keccak256 of workflow JSON
        string uri;          // ipfs:// or https:// pointer to the workflow content
        uint64 createdAt;
    }

    /// @notice All listings, keyed by their id (sequential).
    mapping(uint256 => Listing) public listings;

    /// @notice How many listings have been registered.
    uint256 public listingCount;

    event ListingCreated(
        uint256 indexed id,
        address indexed author,
        bytes32 contentHash,
        string uri
    );

    /// @notice Register a new workflow listing.
    /// @param contentHash keccak256 hash of the canonical workflow JSON.
    /// @param uri         resolvable location of the workflow content.
    function register(bytes32 contentHash, string calldata uri) external returns (uint256 id) {
        id = listingCount++;
        listings[id] = Listing({
            author: msg.sender,
            contentHash: contentHash,
            uri: uri,
            createdAt: uint64(block.timestamp)
        });
        emit ListingCreated(id, msg.sender, contentHash, uri);
    }
}
