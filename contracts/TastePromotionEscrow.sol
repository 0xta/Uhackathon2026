// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITasteTokenContract {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TastePromotionEscrow {
    ITasteTokenContract public tasteToken;
    address public protocolAdmin;
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    event PromotionRedeemed(
        bytes32 indexed placeHash,
        address indexed customer,
        address indexed merchant,
        uint256 totalAmount,
        uint256 merchantAmount,
        uint256 burnedAmount,
        string promoRef
    );

    modifier onlyAdmin() {
        require(msg.sender == protocolAdmin, "Only admin can call");
        _;
    }

    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "Invalid token address");
        tasteToken = ITasteTokenContract(_tokenAddress);
        protocolAdmin = msg.sender;
    }

    /// @notice Customer redeems promotion at merchant venue (e.g. 199 $TASTE for dish, 500 $TASTE for 15% off)
    /// @dev 80% transferred to merchant, 20% permanently burned to DEAD_ADDRESS
    function redeemPromotion(
        bytes32 placeHash,
        address merchant,
        uint256 tasteCost,
        string calldata promoRef
    ) external {
        require(tasteCost > 0, "Cost must be greater than 0");
        require(merchant != address(0), "Invalid merchant address");
        require(merchant != msg.sender, "Customer cannot be merchant");

        uint256 merchantShare = (tasteCost * 80) / 100;
        uint256 burnShare = tasteCost - merchantShare; // 20%

        // Transfer 80% to Merchant
        bool s1 = tasteToken.transferFrom(msg.sender, merchant, merchantShare);
        require(s1, "Merchant token transfer failed");

        // Burn 20% by sending to Dead Address
        bool s2 = tasteToken.transferFrom(msg.sender, DEAD_ADDRESS, burnShare);
        require(s2, "Burn token transfer failed");

        emit PromotionRedeemed(
            placeHash,
            msg.sender,
            merchant,
            tasteCost,
            merchantShare,
            burnShare,
            promoRef
        );
    }
}
