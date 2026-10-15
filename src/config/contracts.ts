export const AVALANCHE_FUJI = {
  chainId: 43113,
  name: "Avalanche Fuji Testnet",
  currency: "AVAX",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.snowtrace.io",
};

export const CONTRACT_ADDRESSES = {
  TasteToken:
    process.env.NEXT_PUBLIC_TASTE_TOKEN_ADDRESS ||
    "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  TasteDailyDistributor:
    process.env.NEXT_PUBLIC_DAILY_DISTRIBUTOR_ADDRESS ||
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  TasteChainRegistry:
    process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
    "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  TasteChainBounty:
    process.env.NEXT_PUBLIC_BOUNTY_ADDRESS ||
    "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  TastePromotionEscrow:
    process.env.NEXT_PUBLIC_PROMOTION_ESCROW_ADDRESS ||
    "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
};

export const TASTE_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function burn(uint256 amount)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
] as const;

export const DAILY_DISTRIBUTOR_ABI = [
  "function finalizeEpoch(uint256 dayIndex, uint256 totalPoints)",
  "function claimReward(uint256 dayIndex, uint256 userPoints, bytes signature)",
  "function hasClaimed(uint256 dayIndex, address user) view returns (bool)",
  "function epochs(uint256 dayIndex) view returns (uint256 totalPoints, uint256 emissionAmount, bool finalized)",
  "event EpochFinalized(uint256 indexed dayIndex, uint256 totalPoints, uint256 totalEmission)",
  "event RewardClaimed(uint256 indexed dayIndex, address indexed user, uint256 userPoints, uint256 amount)",
] as const;

export const REGISTRY_ABI = [
  "function recordReview(bytes32 placeHash, bytes32 slipHash, uint8 rating) returns (bool isPioneer, uint8 pioneerSlot)",
  "function getPioneers(bytes32 placeHash) view returns (address[3] pioneers, uint8 count)",
  "function getPlaceInfo(bytes32 placeHash) view returns (uint8 pioneerCount, uint256 totalReviews)",
  "function isSlipUsed(bytes32 slipHash) view returns (bool)",
  "function getUserDailyReviews(address user, bytes32 placeHash) view returns (uint8 placeReviews, uint8 totalReviews)",
  "function MAX_REVIEWS_PER_PLACE_PER_DAY() view returns (uint8)",
  "function MAX_REVIEWS_PER_DAY() view returns (uint8)",
  "event PioneerRegistered(bytes32 indexed placeHash, address indexed pioneer, uint8 slotIndex)",
  "event ReviewRecorded(bytes32 indexed placeHash, address indexed reviewer, bytes32 indexed slipHash, uint8 rating, bool isPioneer)",
] as const;

export const BOUNTY_ABI = [
  "function fundAvaxBounty(bytes32 placeHash, uint256 rewardPerVisit) payable",
  "function fundTokenBounty(bytes32 placeHash, uint256 totalAmount, uint256 rewardPerVisit)",
  "function claimReward(bytes32 placeHash, address reviewer)",
  "function getBountyInfo(bytes32 placeHash) view returns (address merchant, uint256 remainingFunds, uint256 rewardPerVisit, uint256 totalClaims, bool isToken, bool active)",
  "event BountyFunded(bytes32 indexed placeHash, address indexed merchant, uint256 amount, uint256 rewardPerVisit, bool isToken)",
  "event RewardPaid(bytes32 indexed placeHash, address indexed reviewer, uint256 amount, bool isToken)",
] as const;

export const PROMOTION_ESCROW_ABI = [
  "function redeemPromotion(bytes32 placeHash, address merchant, uint256 tasteCost, string promoRef)",
  "function DEAD_ADDRESS() view returns (address)",
  "event PromotionRedeemed(bytes32 indexed placeHash, address indexed customer, address indexed merchant, uint256 totalAmount, uint256 merchantAmount, uint256 burnedAmount, string promoRef)",
] as const;
