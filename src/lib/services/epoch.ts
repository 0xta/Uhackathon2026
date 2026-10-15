import { query } from "../db";

export interface UserEpochReward {
  epochDate: string;
  userAddress: string;
  userPoints: number;
  totalPlatformPoints: number;
  totalParticipants: number;
  estimatedTasteReward: number;
  claimed: boolean;
  claimTxHash: string | null;
}

export const DAILY_TASTE_EMISSION = 10000;

/**
 * Normalizes date to Bangkok timezone YYYY-MM-DD
 */
export function getBangkokDateString(d: Date = new Date()): string {
  // Asia/Bangkok is UTC+7
  const bangkokTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return bangkokTime.toISOString().slice(0, 10);
}

/**
 * Ensures the daily epoch record exists in daily_token_epochs
 */
export async function ensureDailyEpoch(epochDate?: string): Promise<string> {
  const targetDate = epochDate || getBangkokDateString();
  await query(
    `INSERT INTO daily_token_epochs (epoch_date, total_emission_tokens, total_platform_points, total_participants, status)
     VALUES ($1, $2, 0, 0, 'OPEN')
     ON CONFLICT (epoch_date) DO NOTHING`,
    [targetDate, DAILY_TASTE_EMISSION]
  );
  return targetDate;
}

/**
 * Awards daily activity points to a user address for an epoch date.
 * Automatically recalculates total_platform_points and total_participants.
 */
export async function awardUserEpochPoints(
  userAddress: string,
  points: number,
  epochDate?: string
): Promise<UserEpochReward> {
  const targetDate = await ensureDailyEpoch(epochDate);
  const normalizedAddress = userAddress.toLowerCase().trim();

  // Upsert user points
  const userRes = await query<{ user_points: number; claimed: boolean; claim_tx_hash: string | null }>(
    `INSERT INTO user_epoch_shares (epoch_date, user_address, user_points, calculated_reward_taste, claimed, updated_at)
     VALUES ($1, $2, $3, 0, false, NOW())
     ON CONFLICT (epoch_date, user_address)
     DO UPDATE SET user_points = user_epoch_shares.user_points + $3, updated_at = NOW()
     RETURNING user_points, claimed, claim_tx_hash`,
    [targetDate, normalizedAddress, points]
  );

  // Recalculate epoch totals
  const epochStatsRes = await query<{ total_points: number; total_users: number }>(
    `SELECT COALESCE(SUM(user_points), 0)::int as total_points,
            COUNT(DISTINCT user_address)::int as total_users
     FROM user_epoch_shares
     WHERE epoch_date = $1 AND user_points > 0`,
    [targetDate]
  );

  const totalPlatformPoints = epochStatsRes.rows[0]?.total_points || 0;
  const totalParticipants = epochStatsRes.rows[0]?.total_users || 0;
  const tokenPerPoint = totalPlatformPoints > 0 ? DAILY_TASTE_EMISSION / totalPlatformPoints : 0;

  // Update daily_token_epochs stats
  await query(
    `UPDATE daily_token_epochs
     SET total_platform_points = $2,
         total_participants = $3,
         token_per_point = $4
     WHERE epoch_date = $1`,
    [targetDate, totalPlatformPoints, totalParticipants, tokenPerPoint]
  );

  const currentUserPoints = userRes.rows[0].user_points;
  const estimatedReward =
    totalPlatformPoints > 0
      ? (currentUserPoints / totalPlatformPoints) * DAILY_TASTE_EMISSION
      : 0;

  // Update user's calculated reward
  await query(
    `UPDATE user_epoch_shares
     SET calculated_reward_taste = $3
     WHERE epoch_date = $1 AND user_address = $2`,
    [targetDate, normalizedAddress, estimatedReward]
  );

  return {
    epochDate: targetDate,
    userAddress: normalizedAddress,
    userPoints: currentUserPoints,
    totalPlatformPoints,
    totalParticipants,
    estimatedTasteReward: Math.round(estimatedReward * 10000) / 10000,
    claimed: userRes.rows[0].claimed,
    claimTxHash: userRes.rows[0].claim_tx_hash,
  };
}

/**
 * Retrieves today's epoch status and the user's current points/rewards.
 */
export async function getUserEpochStatus(
  userAddress: string,
  epochDate?: string
): Promise<UserEpochReward> {
  const targetDate = await ensureDailyEpoch(epochDate);
  const normalizedAddress = userAddress.toLowerCase().trim();

  const [epochRes, userRes] = await Promise.all([
    query<{ total_platform_points: number; total_participants: number }>(
      `SELECT total_platform_points, total_participants FROM daily_token_epochs WHERE epoch_date = $1`,
      [targetDate]
    ),
    query<{ user_points: number; calculated_reward_taste: number; claimed: boolean; claim_tx_hash: string | null }>(
      `SELECT user_points, calculated_reward_taste, claimed, claim_tx_hash 
       FROM user_epoch_shares 
       WHERE epoch_date = $1 AND user_address = $2`,
      [targetDate, normalizedAddress]
    ),
  ]);

  const totalPlatformPoints = epochRes.rows[0]?.total_platform_points || 0;
  const totalParticipants = epochRes.rows[0]?.total_participants || 0;
  const userRow = userRes.rows[0];
  const userPoints = userRow?.user_points || 0;

  const estimatedReward =
    totalPlatformPoints > 0
      ? (userPoints / totalPlatformPoints) * DAILY_TASTE_EMISSION
      : 0;

  return {
    epochDate: targetDate,
    userAddress: normalizedAddress,
    userPoints,
    totalPlatformPoints,
    totalParticipants,
    estimatedTasteReward: Math.round(estimatedReward * 10000) / 10000,
    claimed: userRow?.claimed || false,
    claimTxHash: userRow?.claim_tx_hash || null,
  };
}
