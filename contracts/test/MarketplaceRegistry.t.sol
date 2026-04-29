// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MarketplaceRegistry} from "../src/MarketplaceRegistry.sol";

interface Vm {
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;

    function expectRevert(bytes4 revertSelector) external;

    function prank(address msgSender) external;
}

contract MarketplaceRegistryTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MarketplaceRegistry private registry;

    event ListingCreated(
        uint256 indexed id,
        address indexed author,
        bytes32 contentHash,
        string uri
    );
    event ListingApproved(uint256 indexed id, address indexed curator);
    event ListingArchived(uint256 indexed id, address indexed curator);

    function setUp() public {
        registry = new MarketplaceRegistry();
    }

    function testRegisterCreatesPendingListingAndEmitsEvent() public {
        bytes32 contentHash = keccak256(bytes("workflow-json"));
        string memory uri = "ipfs://workflow-1";

        vm.expectEmit(true, true, true, true);
        emit ListingCreated(0, address(this), contentHash, uri);

        uint256 id = registry.register(contentHash, uri);

        require(id == 0, "listing id mismatch");
        require(registry.listingCount() == 1, "listing count mismatch");

        (
            address author,
            bytes32 storedHash,
            string memory storedUri,
            uint64 createdAt,
            MarketplaceRegistry.ListingStatus status
        ) = registry.getListing(id);

        require(author == address(this), "author mismatch");
        require(storedHash == contentHash, "content hash mismatch");
        require(keccak256(bytes(storedUri)) == keccak256(bytes(uri)), "uri mismatch");
        require(createdAt > 0, "createdAt not set");
        require(
            uint256(status) == uint256(MarketplaceRegistry.ListingStatus.Pending),
            "status mismatch"
        );
    }

    function testRegisterRejectsInvalidInputsAndDuplicates() public {
        vm.expectRevert(MarketplaceRegistry.InvalidContentHash.selector);
        registry.register(bytes32(0), "ipfs://workflow-1");

        vm.expectRevert(MarketplaceRegistry.InvalidURI.selector);
        registry.register(keccak256(bytes("workflow-json")), "");

        bytes32 contentHash = keccak256(bytes("workflow-json"));
        registry.register(contentHash, "ipfs://workflow-1");

        vm.expectRevert(MarketplaceRegistry.ContentHashAlreadyRegistered.selector);
        registry.register(contentHash, "ipfs://workflow-2");
    }

    function testCuratorCanApproveAndArchiveListing() public {
        uint256 id = registry.register(
            keccak256(bytes("workflow-json")),
            "https://example.com/workflow"
        );

        vm.expectEmit(true, true, false, false);
        emit ListingApproved(id, address(this));
        registry.approveListing(id);

        (, , , , MarketplaceRegistry.ListingStatus approvedStatus) = registry.getListing(id);
        require(
            uint256(approvedStatus) == uint256(MarketplaceRegistry.ListingStatus.Approved),
            "approved status mismatch"
        );

        vm.expectEmit(true, true, false, false);
        emit ListingArchived(id, address(this));
        registry.archiveListing(id);

        (, , , , MarketplaceRegistry.ListingStatus archivedStatus) = registry.getListing(id);
        require(
            uint256(archivedStatus) == uint256(MarketplaceRegistry.ListingStatus.Archived),
            "archived status mismatch"
        );
    }

    function testNonCuratorCannotApproveOrArchive() public {
        uint256 id = registry.register(
            keccak256(bytes("workflow-json")),
            "https://example.com/workflow"
        );
        address outsider = address(0xBEEF);

        vm.prank(outsider);
        vm.expectRevert(MarketplaceRegistry.NotCurator.selector);
        registry.approveListing(id);

        vm.prank(outsider);
        vm.expectRevert(MarketplaceRegistry.NotCurator.selector);
        registry.archiveListing(id);
    }

    function testCannotApproveArchivedListing() public {
        uint256 id = registry.register(
            keccak256(bytes("workflow-json")),
            "https://example.com/workflow"
        );

        registry.archiveListing(id);

        vm.expectRevert(MarketplaceRegistry.InvalidListingStatus.selector);
        registry.approveListing(id);
    }

    function testCannotArchiveTwice() public {
        uint256 id = registry.register(
            keccak256(bytes("workflow-json")),
            "https://example.com/workflow"
        );

        registry.archiveListing(id);

        vm.expectRevert(MarketplaceRegistry.InvalidListingStatus.selector);
        registry.archiveListing(id);
    }

    function testUnknownListingReverts() public {
        vm.expectRevert(MarketplaceRegistry.ListingNotFound.selector);
        registry.getListing(1);

        vm.expectRevert(MarketplaceRegistry.ListingNotFound.selector);
        registry.approveListing(1);
    }

    function testCuratorTransferUpdatesAccessControl() public {
        address newCurator = address(0xCAFE);

        registry.transferCurator(newCurator);
        require(registry.curator() == newCurator, "curator mismatch");

        vm.expectRevert(MarketplaceRegistry.NotCurator.selector);
        registry.approveListing(0);

        vm.prank(newCurator);
        registry.register(keccak256(bytes("workflow-json")), "https://example.com/workflow");

        vm.prank(newCurator);
        registry.approveListing(0);

        (, , , , MarketplaceRegistry.ListingStatus status) = registry.getListing(0);
        require(
            uint256(status) == uint256(MarketplaceRegistry.ListingStatus.Approved),
            "new curator approval failed"
        );
    }

    function testApprovedListingCountAndPaginationUpdate() public {
        uint256 first = registry.register(
            keccak256(bytes("workflow-1")),
            "https://example.com/workflow-1"
        );
        uint256 second = registry.register(
            keccak256(bytes("workflow-2")),
            "https://example.com/workflow-2"
        );

        registry.approveListing(first);
        registry.approveListing(second);

        require(registry.approvedListingCount() == 2, "approved count mismatch");
        require(registry.getApprovedListingId(0) == first, "first approved id mismatch");
        require(registry.getApprovedListingId(1) == second, "second approved id mismatch");

        uint256[] memory ids = registry.getApprovedListingIds(0, 2);
        require(ids.length == 2, "pagination length mismatch");
        require(ids[0] == first, "pagination first mismatch");
        require(ids[1] == second, "pagination second mismatch");

        registry.archiveListing(first);

        require(registry.approvedListingCount() == 1, "approved count after archive mismatch");

        uint256[] memory remaining = registry.getApprovedListingIds(0, 1);
        require(remaining.length == 1, "remaining pagination length mismatch");
        require(remaining[0] == second, "remaining approved id mismatch");
    }
}
