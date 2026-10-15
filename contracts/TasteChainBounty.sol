// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Token {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract TasteChainBounty {
    address public protocolTreasury;
    address public oracleAddress;
    IERC20Token public tasteToken;

    struct BountyPool {
        address merchant;
        uint256 remainingFunds;
        uint256 rewardPerVisit;
        uint256 totalClaims;
        bool isToken; // false = native AVAX, true = $TASTE ERC20
        bool active;
    }

    // placeHash => BountyPool
    mapping(bytes32 => BountyPool) public placeBounties;

    event BountyFunded(bytes32 indexed placeHash, address indexed merchant, uint256 amount, uint256 rewardPerVisit, bool isToken);
    event RewardPaid(bytes32 indexed placeHash, address indexed reviewer, uint256 amount, bool isToken);
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);

    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Only oracle can trigger payout");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == protocolTreasury, "Only treasury admin can call");
        _;
    }

    constructor(address _treasury, address _oracle, address _token) {
        require(_treasury != address(0), "Invalid treasury");
        require(_oracle != address(0), "Invalid oracle");
        protocolTreasury = _treasury;
        oracleAddress = _oracle;
        if (_token != address(0)) {
            tasteToken = IERC20Token(_token);
        }
    }

    function setTasteToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        tasteToken = IERC20Token(_token);
    }

    /// @notice Merchant funds native AVAX bounty campaign
    function fundAvaxBounty(bytes32 placeHash, uint256 rewardPerVisit) external payable {
        require(msg.value >= rewardPerVisit, "Deposit is less than reward per visit");
        require(rewardPerVisit > 0, "Reward per visit must be > 0");

        BountyPool storage pool = placeBounties[placeHash];
        pool.merchant = msg.sender;
        pool.remainingFunds += msg.value;
        pool.rewardPerVisit = rewardPerVisit;
        pool.isToken = false;
        pool.active = true;

        emit BountyFunded(placeHash, msg.sender, msg.value, rewardPerVisit, false);
    }

    /// @notice Merchant funds $TASTE ERC-20 bounty campaign (e.g. 100,000 $TASTE for 30 days)
    function fundTokenBounty(bytes32 placeHash, uint256 totalAmount, uint256 rewardPerVisit) external {
        require(address(tasteToken) != address(0), "Taste token not configured");
        require(totalAmount >= rewardPerVisit, "Deposit is less than reward per visit");
        require(rewardPerVisit > 0, "Reward per visit must be > 0");

        bool success = tasteToken.transferFrom(msg.sender, address(this), totalAmount);
        require(success, "Token transfer failed");

        BountyPool storage pool = placeBounties[placeHash];
        pool.merchant = msg.sender;
        pool.remainingFunds += totalAmount;
        pool.rewardPerVisit = rewardPerVisit;
        pool.isToken = true;
        pool.active = true;

        emit BountyFunded(placeHash, msg.sender, totalAmount, rewardPerVisit, true);
    }

    /// @notice Oracle triggers reward claim after verified Proof-of-Visit
    /// @dev Direct 100% payout to reviewer (Pioneer receives 2x daily points in distributor instead of split)
    function claimReward(bytes32 placeHash, address reviewer) external onlyOracle {
        BountyPool storage pool = placeBounties[placeHash];
        require(pool.active, "Bounty pool is not active");
        require(pool.remainingFunds >= pool.rewardPerVisit, "Insufficient bounty funds remaining");
        require(reviewer != address(0), "Invalid reviewer address");

        uint256 payout = pool.rewardPerVisit;
        pool.remainingFunds -= payout;
        pool.totalClaims++;

        if (pool.remainingFunds < pool.rewardPerVisit) {
            pool.active = false;
        }

        if (pool.isToken) {
            bool success = tasteToken.transfer(reviewer, payout);
            require(success, "Token transfer failed");
            emit RewardPaid(placeHash, reviewer, payout, true);
        } else {
            (bool success, ) = payable(reviewer).call{value: payout}("");
            require(success, "AVAX transfer failed");
            emit RewardPaid(placeHash, reviewer, payout, false);
        }
    }

    function getBountyInfo(bytes32 placeHash) external view returns (
        address merchant,
        uint256 remainingFunds,
        uint256 rewardPerVisit,
        uint256 totalClaims,
        bool isToken,
        bool active
    ) {
        BountyPool storage p = placeBounties[placeHash];
        return (p.merchant, p.remainingFunds, p.rewardPerVisit, p.totalClaims, p.isToken, p.active);
    }

    function setOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid oracle");
        emit OracleUpdated(oracleAddress, _newOracle);
        oracleAddress = _newOracle;
    }
}
