// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MarketplaceRegistry
/// @notice Onchain registry for workflow listings. Agents register workflow
///         content hashes here so other agents can discover them trustlessly.
/// @dev    Integration point for the Gensyn AXL track - agents communicate
///         through this registry instead of a central coordinator.
contract MarketplaceRegistry {
    enum ListingStatus {
        Pending,
        Approved,
        Archived
    }

    struct Listing {
        address author;
        bytes32 contentHash; // keccak256 of workflow JSON
        string uri; // ipfs:// or https:// pointer to the workflow content
        uint64 createdAt;
        ListingStatus status;
    }

    error NotCurator();
    error InvalidCurator();
    error InvalidListingStatus();
    error ListingNotFound();
    error InvalidContentHash();
    error InvalidURI();
    error ContentHashAlreadyRegistered();

    address public curator;

    /// @notice All listings, keyed by their id.
    mapping(uint256 => Listing) public listings;

    /// @notice How many listings have been registered.
    uint256 public listingCount;

    /// @dev Stores listing id + 1 to distinguish id 0 from "not registered".
    mapping(bytes32 => uint256) private contentHashToListingIdPlusOne;

    /// @dev List of currently approved listing ids.
    uint256[] private approvedListingIds;

    /// @dev Stores approvedListingIds index + 1.
    mapping(uint256 => uint256) private approvedListingIndexPlusOne;

    event ListingCreated(
        uint256 indexed id,
        address indexed author,
        bytes32 contentHash,
        string uri
    );

    event ListingApproved(uint256 indexed id, address indexed curator);
    event ListingArchived(uint256 indexed id, address indexed curator);

    event CuratorTransferred(
        address indexed previousCurator,
        address indexed newCurator
    );

    constructor() {
        curator = msg.sender;
    }

    modifier onlyCurator() {
        if (msg.sender != curator) {
            revert NotCurator();
        }
        _;
    }

    /// @notice Register a new workflow listing.
    /// @param contentHash keccak256 hash of the canonical workflow JSON.
    /// @param uri         resolvable location of the workflow content.
    function register(
        bytes32 contentHash,
        string calldata uri
    ) external returns (uint256 id) {
        if (contentHash == bytes32(0)) {
            revert InvalidContentHash();
        }

        if (bytes(uri).length == 0) {
            revert InvalidURI();
        }

        if (contentHashToListingIdPlusOne[contentHash] != 0) {
            revert ContentHashAlreadyRegistered();
        }

        id = listingCount++;

        listings[id] = Listing({
            author: msg.sender,
            contentHash: contentHash,
            uri: uri,
            createdAt: uint64(block.timestamp),
            status: ListingStatus.Pending
        });

        contentHashToListingIdPlusOne[contentHash] = id + 1;

        emit ListingCreated(id, msg.sender, contentHash, uri);
    }

    /// @notice Approve a pending listing so it becomes discoverable.
    function approveListing(uint256 id) external onlyCurator {
        Listing storage listing = _listingOrRevert(id);

        if (listing.status != ListingStatus.Pending) {
            revert InvalidListingStatus();
        }

        listing.status = ListingStatus.Approved;
        _addApprovedListingId(id);

        emit ListingApproved(id, msg.sender);
    }

    /// @notice Archive an approved or pending listing.
    function archiveListing(uint256 id) external onlyCurator {
        Listing storage listing = _listingOrRevert(id);

        if (listing.status == ListingStatus.Archived) {
            revert InvalidListingStatus();
        }

        if (listing.status == ListingStatus.Approved) {
            _removeApprovedListingId(id);
        }

        listing.status = ListingStatus.Archived;

        emit ListingArchived(id, msg.sender);
    }

    /// @notice Transfer curator role to another address.
    function transferCurator(address newCurator) external onlyCurator {
        if (newCurator == address(0)) {
            revert InvalidCurator();
        }

        address previousCurator = curator;
        curator = newCurator;

        emit CuratorTransferred(previousCurator, newCurator);
    }

    /// @notice Read a listing with the enum status preserved.
    function getListing(uint256 id)
        external
        view
        returns (
            address author,
            bytes32 contentHash,
            string memory uri,
            uint64 createdAt,
            ListingStatus status
        )
    {
        Listing storage listing = _listingOrRevert(id);

        return (
            listing.author,
            listing.contentHash,
            listing.uri,
            listing.createdAt,
            listing.status
        );
    }

    /// @notice Return whether a content hash has already been registered.
    function isContentHashRegistered(bytes32 contentHash)
        external
        view
        returns (bool)
    {
        return contentHashToListingIdPlusOne[contentHash] != 0;
    }

    /// @notice Return listing id by content hash.
    function getListingIdByContentHash(bytes32 contentHash)
        external
        view
        returns (uint256 id)
    {
        uint256 idPlusOne = contentHashToListingIdPlusOne[contentHash];

        if (idPlusOne == 0) {
            revert ListingNotFound();
        }

        return idPlusOne - 1;
    }

    /// @notice Number of currently approved listings.
    function approvedListingCount() external view returns (uint256) {
        return approvedListingIds.length;
    }

    /// @notice Return an approved listing id by index.
    function getApprovedListingId(uint256 index) external view returns (uint256) {
        return approvedListingIds[index];
    }

    /// @notice Return approved listing ids using pagination.
    function getApprovedListingIds(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory ids) {
        uint256 total = approvedListingIds.length;

        if (offset >= total) {
            return new uint256[](0);
        }

        uint256 remaining = total - offset;
        uint256 length = limit < remaining ? limit : remaining;

        ids = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            ids[i] = approvedListingIds[offset + i];
        }
    }

    function _listingOrRevert(
        uint256 id
    ) internal view returns (Listing storage listing) {
        if (id >= listingCount) {
            revert ListingNotFound();
        }

        listing = listings[id];
    }

    function _addApprovedListingId(uint256 id) internal {
        if (approvedListingIndexPlusOne[id] != 0) {
            return;
        }

        approvedListingIds.push(id);
        approvedListingIndexPlusOne[id] = approvedListingIds.length;
    }

    function _removeApprovedListingId(uint256 id) internal {
        uint256 indexPlusOne = approvedListingIndexPlusOne[id];

        if (indexPlusOne == 0) {
            return;
        }

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = approvedListingIds.length - 1;

        if (index != lastIndex) {
            uint256 lastId = approvedListingIds[lastIndex];

            approvedListingIds[index] = lastId;
            approvedListingIndexPlusOne[lastId] = index + 1;
        }

        approvedListingIds.pop();
        delete approvedListingIndexPlusOne[id];
    }
}