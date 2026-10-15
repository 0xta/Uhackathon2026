import { query } from "../db";

export interface PlaceListItem {
  id: string;
  place_id: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  service_type: string | null;
  business_status: string | null;
  rating: number | null;
  total_reviews: number | null;
  google_map_url: string | null;
  pioneer_count: number;
  has_active_bounty: boolean;
  bounty_avax: number;
  bounty_taste: number;
  active_promotions: number;
}

export interface PlaceDetail extends PlaceListItem {
  opening_hours?: any;
  website?: string | null;
  pioneers: Array<{
    slot_index: number;
    pioneer_address: string;
    total_royalty_earned_avax: number;
    claimed_at: string;
  }>;
  recent_reviews: Array<{
    id: string;
    reviewer_address: string;
    rating: number;
    review_text: string;
    verification_tier: number;
    onchain_tx_hash: string | null;
    is_pioneer: boolean;
    created_at: string;
  }>;
  promotions: Array<{
    id: string;
    promo_type: string;
    title: string;
    description: string | null;
    cost_in_taste: number;
    discount_percent: number;
    min_spend_thb: number;
    max_redemptions: number;
    total_redeemed: number;
  }>;
  shop_voices: Array<{
    id: string;
    slot_number: number;
    title: string;
    audio_url: string;
    duration_seconds: number;
  }>;
}

export interface SearchPlacesParams {
  q?: string;
  service_type?: string;
  min_rating?: number;
  has_bounty?: boolean;
  pioneer_open?: boolean;
  limit?: number;
  offset?: number;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
}

export const BANGKOK_FNB_TYPES = [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "coffee_shop",
  "thai_restaurant",
  "noodle_shop",
  "japanese_restaurant",
  "fast_food_restaurant",
  "chinese_restaurant",
];

export async function getBangkokPlaces(params: SearchPlacesParams = {}): Promise<{
  places: PlaceListItem[];
  total: number;
  limit: number;
  offset: number;
}> {
  const {
    q,
    service_type,
    min_rating,
    has_bounty,
    pioneer_open,
    limit = 20,
    offset = 0,
    minLat,
    maxLat,
    minLng,
    maxLng,
  } = params;

  const conditions: string[] = [
    "p.city = 'กรุงเทพมหานคร'",
    "p.business_status = 'OPERATIONAL'",
  ];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (service_type && service_type !== "all") {
    conditions.push(`p.service_type = $${paramIndex++}`);
    queryParams.push(service_type);
  } else {
    // Default to Bangkok F&B types
    conditions.push(`p.service_type = ANY($${paramIndex++})`);
    queryParams.push(BANGKOK_FNB_TYPES);
  }

  if (q && q.trim()) {
    conditions.push(
      `(p.name ILIKE $${paramIndex} OR p.address ILIKE $${paramIndex})`
    );
    queryParams.push(`%${q.trim()}%`);
    paramIndex++;
  }

  if (min_rating && min_rating > 0) {
    conditions.push(`p.rating >= $${paramIndex++}`);
    queryParams.push(min_rating);
  }

  if (minLat !== undefined && maxLat !== undefined && minLng !== undefined && maxLng !== undefined) {
    conditions.push(
      `p.latitude BETWEEN $${paramIndex++} AND $${paramIndex++} AND p.longitude BETWEEN $${paramIndex++} AND $${paramIndex++}`
    );
    queryParams.push(minLat, maxLat, minLng, maxLng);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Having clause for aggregate filters (bounty, pioneer_open)
  const havingConditions: string[] = [];
  if (has_bounty) {
    havingConditions.push(
      "(COALESCE(SUM(mb.remaining_budget_avax), 0) > 0 OR COALESCE(SUM(mtb.remaining_budget_taste), 0) > 0)"
    );
  }
  if (pioneer_open) {
    havingConditions.push("COUNT(DISTINCT pc.id) < 3");
  }
  const havingClause = havingConditions.length > 0 ? `HAVING ${havingConditions.join(" AND ")}` : "";

  // Main list query with aggregate joins
  const listSql = `
    SELECT 
      p.id,
      p.place_id,
      p.name,
      p.address,
      p.city,
      p.latitude,
      p.longitude,
      p.service_type,
      p.business_status,
      p.rating,
      p.total_reviews,
      p.google_map_url,
      COUNT(DISTINCT pc.id)::int AS pioneer_count,
      (COALESCE(SUM(mb.remaining_budget_avax), 0) > 0 OR COALESCE(SUM(mtb.remaining_budget_taste), 0) > 0) AS has_active_bounty,
      COALESCE(SUM(mb.remaining_budget_avax), 0)::float AS bounty_avax,
      COALESCE(SUM(mtb.remaining_budget_taste), 0)::float AS bounty_taste,
      COUNT(DISTINCT mp.id)::int AS active_promotions
    FROM places p
    LEFT JOIN pioneer_claims pc ON p.place_id = pc.place_id
    LEFT JOIN merchant_bounties mb ON p.place_id = mb.place_id AND mb.status = 'ACTIVE'
    LEFT JOIN merchant_token_bounties mtb ON p.place_id = mtb.place_id AND mtb.status = 'ACTIVE'
    LEFT JOIN merchant_promotions mp ON p.place_id = mp.place_id AND mp.is_active = true
    ${whereClause}
    GROUP BY p.id
    ${havingClause}
    ORDER BY has_active_bounty DESC, p.rating DESC NULLS LAST, p.total_reviews DESC NULLS LAST
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  const listParams = [...queryParams, Math.min(limit, 100), offset];
  const listResult = await query<PlaceListItem>(listSql, listParams);

  // Fast count query
  let total = 0;
  if (havingClause) {
    // If aggregates are filtered, count using a subquery
    const countSql = `
      SELECT COUNT(*)::int AS total FROM (
        SELECT p.id
        FROM places p
        LEFT JOIN pioneer_claims pc ON p.place_id = pc.place_id
        LEFT JOIN merchant_bounties mb ON p.place_id = mb.place_id AND mb.status = 'ACTIVE'
        LEFT JOIN merchant_token_bounties mtb ON p.place_id = mtb.place_id AND mtb.status = 'ACTIVE'
        ${whereClause}
        GROUP BY p.id
        ${havingClause}
      ) sub
    `;
    const countRes = await query<{ total: number }>(countSql, queryParams);
    total = countRes.rows[0]?.total || 0;
  } else {
    const countSql = `SELECT COUNT(*)::int AS total FROM places p ${whereClause}`;
    const countRes = await query<{ total: number }>(countSql, queryParams);
    total = countRes.rows[0]?.total || 0;
  }

  return {
    places: listResult.rows,
    total,
    limit,
    offset,
  };
}

export async function getPlaceById(placeId: string): Promise<PlaceDetail | null> {
  const placeSql = `
    SELECT 
      p.id,
      p.place_id,
      p.name,
      p.address,
      p.city,
      p.latitude,
      p.longitude,
      p.service_type,
      p.business_status,
      p.rating,
      p.total_reviews,
      p.google_map_url,
      p.website,
      p.opening_hours,
      COUNT(DISTINCT pc.id)::int AS pioneer_count,
      (COALESCE(SUM(mb.remaining_budget_avax), 0) > 0 OR COALESCE(SUM(mtb.remaining_budget_taste), 0) > 0) AS has_active_bounty,
      COALESCE(SUM(mb.remaining_budget_avax), 0)::float AS bounty_avax,
      COALESCE(SUM(mtb.remaining_budget_taste), 0)::float AS bounty_taste,
      COUNT(DISTINCT mp.id)::int AS active_promotions
    FROM places p
    LEFT JOIN pioneer_claims pc ON p.place_id = pc.place_id
    LEFT JOIN merchant_bounties mb ON p.place_id = mb.place_id AND mb.status = 'ACTIVE'
    LEFT JOIN merchant_token_bounties mtb ON p.place_id = mtb.place_id AND mtb.status = 'ACTIVE'
    LEFT JOIN merchant_promotions mp ON p.place_id = mp.place_id AND mp.is_active = true
    WHERE p.place_id = $1
    GROUP BY p.id
    LIMIT 1
  `;
  const placeRes = await query(placeSql, [placeId]);
  if (placeRes.rows.length === 0) return null;

  const base = placeRes.rows[0];

  // Fetch Pioneers
  const pioneersRes = await query(
    `SELECT slot_index, pioneer_address, total_royalty_earned_avax::float, claimed_at
     FROM pioneer_claims WHERE place_id = $1 ORDER BY slot_index ASC`,
    [placeId]
  );

  // Fetch Reviews
  const reviewsRes = await query(
    `SELECT id, reviewer_address, rating, review_text, verification_tier, onchain_tx_hash, is_pioneer, created_at
     FROM verified_reviews WHERE place_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [placeId]
  );

  // Fetch Promotions
  const promosRes = await query(
    `SELECT id, promo_type, title, description, cost_in_taste::float, discount_percent, min_spend_thb::float, max_redemptions, total_redeemed
     FROM merchant_promotions WHERE place_id = $1 AND is_active = true ORDER BY cost_in_taste ASC`,
    [placeId]
  );

  // Fetch Shop Voices
  const voicesRes = await query(
    `SELECT id, slot_number, title, audio_url, duration_seconds::float
     FROM shop_voices WHERE place_id = $1 AND is_active = true ORDER BY slot_number ASC`,
    [placeId]
  );

  return {
    ...base,
    pioneers: pioneersRes.rows,
    recent_reviews: reviewsRes.rows,
    promotions: promosRes.rows,
    shop_voices: voicesRes.rows,
  };
}

export async function getBangkokStats() {
  const [placesRes, reviewsRes, pioneersRes] = await Promise.all([
    query<{ total_venues: number }>(
      `SELECT COUNT(*)::int AS total_venues FROM places 
       WHERE city = 'กรุงเทพมหานคร' AND business_status = 'OPERATIONAL' 
         AND service_type = ANY($1)`,
      [BANGKOK_FNB_TYPES]
    ),
    query<{ total_reviews: number; total_avax_distributed: number }>(
      `SELECT COUNT(*)::int AS total_reviews, COALESCE(SUM(bounty_reward_avax), 0)::float AS total_avax_distributed 
       FROM verified_reviews WHERE status = 'CONFIRMED'`
    ),
    query<{ total_pioneers: number }>(
      `SELECT COUNT(*)::int AS total_pioneers FROM pioneer_claims`
    ),
  ]);

  return {
    total_venues: placesRes.rows[0]?.total_venues || 36369,
    total_reviews: reviewsRes.rows[0]?.total_reviews || 0,
    total_pioneers: pioneersRes.rows[0]?.total_pioneers || 0,
    total_avax_distributed: reviewsRes.rows[0]?.total_avax_distributed || 0,
  };
}
