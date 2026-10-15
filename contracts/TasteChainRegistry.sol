// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TasteChainRegistry {
    address public owner;

    struct PlaceInfo {
        address[3] pioneers;
        uint8 pioneerCount;
        uint256 totalReviews;
    }

    // Key: keccak256(placeId) computed off-chain for gas efficiency
    mapping(bytes32 => PlaceInfo) public places;
    mapping(bytes32 => bool) public usedSlipHashes;

    event PioneerRegistered(bytes32 indexed placeHash, address indexed pioneer, uint8 slotIndex);
    event ReviewRecorded(bytes32 indexed placeHash, address indexed reviewer, bytes32 indexed slipHash, uint8 rating, bool isPioneer);

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Record a verified review and auto-assign Pioneer slot if available
    /// @param placeHash keccak256(abi.encodePacked(placeId))
    /// @param slipHash SHA-256 hash of the bank transaction reference ID
    /// @param rating 1-5 star rating
    function recordReview(
        bytes32 placeHash,
        bytes32 slipHash,
        uint8 rating
    ) external returns (bool isPioneer, uint8 pioneerSlot) {
        require(rating >= 1 && rating <= 5, "Invalid rating: must be 1 to 5");
        require(!usedSlipHashes[slipHash], "Slip reference has already been used");

        usedSlipHashes[slipHash] = true;
        places[placeHash].totalReviews++;

        // Auto-assign Pioneer slot if fewer than 3 pioneers exist
        if (places[placeHash].pioneerCount < 3) {
            uint8 slot = places[placeHash].pioneerCount;
            places[placeHash].pioneers[slot] = msg.sender;
            places[placeHash].pioneerCount++;

            emit PioneerRegistered(placeHash, msg.sender, slot + 1);
            emit ReviewRecorded(placeHash, msg.sender, slipHash, rating, true);
            return (true, slot + 1);
        }

        emit ReviewRecorded(placeHash, msg.sender, slipHash, rating, false);
        return (false, 0);
    }

    function getPioneers(bytes32 placeHash) external view returns (address[3] memory, uint8) {
        return (places[placeHash].pioneers, places[placeHash].pioneerCount);
    }

    function getPlaceInfo(bytes32 placeHash) external view returns (uint8 pioneerCount, uint256 totalReviews) {
        PlaceInfo storage p = places[placeHash];
        return (p.pioneerCount, p.totalReviews);
    }

    function isSlipUsed(bytes32 slipHash) external view returns (bool) {
        return usedSlipHashes[slipHash];
    }
}
