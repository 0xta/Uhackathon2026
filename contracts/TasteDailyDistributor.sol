// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITasteToken {
    function mint(address to, uint256 amount) external;
}

contract TasteDailyDistributor {
    address public owner;
    address public oracleAddress;
    ITasteToken public tasteToken;

    uint256 public constant DAILY_EMISSION = 10_000 * 10**18; // 10,000 $TASTE

    struct EpochData {
        uint256 totalPoints;
        uint256 emissionAmount;
        bool finalized;
    }

    // dayIndex => EpochData
    mapping(uint256 => EpochData) public epochs;
    // dayIndex => (userAddress => hasClaimed)
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event EpochFinalized(uint256 indexed dayIndex, uint256 totalPoints, uint256 totalEmission);
    event RewardClaimed(uint256 indexed dayIndex, address indexed user, uint256 userPoints, uint256 amount);
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);

    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Caller is not the oracle");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    constructor(address _tokenAddress, address _oracle) {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_oracle != address(0), "Invalid oracle address");
        owner = msg.sender;
        tasteToken = ITasteToken(_tokenAddress);
        oracleAddress = _oracle;
    }

    /// @notice Oracle finalizes the epoch for a given day index with the platform's aggregate review points
    function finalizeEpoch(uint256 dayIndex, uint256 totalPoints) external onlyOracle {
        require(!epochs[dayIndex].finalized, "Epoch already finalized");
        require(totalPoints > 0, "Total points must be > 0");

        epochs[dayIndex] = EpochData({
            totalPoints: totalPoints,
            emissionAmount: DAILY_EMISSION,
            finalized: true
        });

        emit EpochFinalized(dayIndex, totalPoints, DAILY_EMISSION);
    }

    /// @notice Mechanism B: User claims their pro-rata reward using an authorized Oracle ECDSA signature
    /// @param dayIndex Day index of the epoch (e.g. block.timestamp / 86400 or YYYYMMDD)
    /// @param userPoints Verified points earned by msg.sender on dayIndex (with 2x Pioneer multiplier if applicable)
    /// @param signature Oracle-signed cryptographic authorization for msg.sender
    function claimReward(
        uint256 dayIndex,
        uint256 userPoints,
        bytes calldata signature
    ) external {
        EpochData storage epoch = epochs[dayIndex];
        require(epoch.finalized, "Epoch not yet finalized");
        require(!hasClaimed[dayIndex][msg.sender], "Reward already claimed for this day");
        require(userPoints > 0, "User points must be > 0");
        require(userPoints <= epoch.totalPoints, "User points exceed total epoch points");

        // Compute message hash: keccak256(dayIndex, userAddress, userPoints, chainId, contractAddress)
        bytes32 messageHash = keccak256(
            abi.encodePacked(dayIndex, msg.sender, userPoints, block.chainid, address(this))
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        address signer = recoverSigner(ethSignedMessageHash, signature);
        require(signer == oracleAddress, "Invalid oracle signature");

        hasClaimed[dayIndex][msg.sender] = true;

        // Pro-Rata Math: (userPoints * 10,000 $TASTE) / totalPoints
        uint256 userReward = (userPoints * epoch.emissionAmount) / epoch.totalPoints;
        tasteToken.mint(msg.sender, userReward);

        emit RewardClaimed(dayIndex, msg.sender, userPoints, userReward);
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _sig) internal pure returns (address) {
        require(_sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(_sig, 32))
            s := mload(add(_sig, 64))
            v := byte(0, mload(add(_sig, 96)))
        }
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function setOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid oracle address");
        emit OracleUpdated(oracleAddress, _newOracle);
        oracleAddress = _newOracle;
    }
}
