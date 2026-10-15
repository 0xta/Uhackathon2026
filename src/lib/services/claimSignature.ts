import { ethers } from "ethers";
import { query } from "../db";
import { getUserEpochStatus, DAILY_TASTE_EMISSION } from "./epoch";
import contractsConfig from "../../config/contracts.json";

// Default Fuji Oracle private key (corresponds to deployer/oracle in dev/test)
const ORACLE_PRIVATE_KEY =
  process.env.ORACLE_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export interface ClaimSignatureResult {
  userAddress: string;
  epochDate: string;
  epochDateUint: number;
  userPoints: number;
  totalPlatformPoints: number;
  rewardTasteWei: string;
  rewardTasteFormatted: number;
  distributorAddress: string;
  oracleAddress: string;
  signature: string;
  claimed: boolean;
}

/**
 * Converts date string YYYY-MM-DD to uint256 YYYYMMDD
 */
export function dateStringToUint(dateStr: string): number {
  return parseInt(dateStr.replace(/-/g, ""), 10);
}

/**
 * Generates an ECDSA signature from the Oracle for Mechanism B token claims.
 * The signature authorizes the user to call TasteDailyDistributor.claimReward(epochDate, points, signature).
 */
export async function generateClaimSignature(
  userAddress: string,
  epochDate?: string
): Promise<ClaimSignatureResult> {
  const normAddress = userAddress.toLowerCase().trim();
  const epochStatus = await getUserEpochStatus(normAddress, epochDate);

  if (epochStatus.userPoints <= 0) {
    throw new Error(`User has 0 points in epoch ${epochStatus.epochDate}. No $TASTE reward to claim.`);
  }

  const distributorAddress = contractsConfig.TasteDailyDistributor;
  const oracleWallet = new ethers.Wallet(ORACLE_PRIVATE_KEY);
  const epochDateUint = dateStringToUint(epochStatus.epochDate);

  // Exact reward in Wei (18 decimals)
  const rewardWei = ethers.parseEther(epochStatus.estimatedTasteReward.toFixed(18));

  // EIP-191 message hash matching TasteDailyDistributor.sol:
  // bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, epochDate, points));
  // bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
  const packedMessage = ethers.solidityPackedKeccak256(
    ["address", "uint256", "uint256"],
    [normAddress, epochDateUint, epochStatus.userPoints]
  );

  const signature = await oracleWallet.signMessage(ethers.getBytes(packedMessage));

  return {
    userAddress: normAddress,
    epochDate: epochStatus.epochDate,
    epochDateUint,
    userPoints: epochStatus.userPoints,
    totalPlatformPoints: epochStatus.totalPlatformPoints,
    rewardTasteWei: rewardWei.toString(),
    rewardTasteFormatted: epochStatus.estimatedTasteReward,
    distributorAddress,
    oracleAddress: oracleWallet.address,
    signature,
    claimed: epochStatus.claimed,
  };
}

/**
 * Marks epoch shares as claimed upon confirmation of on-chain tx.
 */
export async function recordClaimSuccess(
  userAddress: string,
  epochDate: string,
  txHash: string
): Promise<void> {
  const normAddress = userAddress.toLowerCase().trim();
  await query(
    `UPDATE user_epoch_shares 
     SET claimed = true, claim_tx_hash = $3, updated_at = NOW() 
     WHERE epoch_date = $1 AND user_address = $2`,
    [epochDate, normAddress, txHash]
  );
}
