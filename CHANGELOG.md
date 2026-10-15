# Changelog

All notable changes to the **TasteChain BKK** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed
- **Pioneer Incentive Simplification**:
  - Deprecated the complex 5% royalty pool distribution from merchant bounties to eliminate on-chain loop overhead and keep math simple.
  - Implemented **Pioneer 2x Multiplier**: When a user is confirmed as one of the 3 Pioneers for a venue, their daily activity points for that review are doubled (**2x points**), granting them double pro-rata share in the 10,000 $TASTE daily mining pool.
- **Review Rate Limiting Rule**:
  - Added strict daily review limits: **Max 3 reviews per venue per day** and **Max 10 total reviews across all venues per day** per wallet address.
  - Enforced on-chain in `TasteChainRegistry.sol` (`MAX_REVIEWS_PER_PLACE_PER_DAY = 3`, `MAX_REVIEWS_PER_DAY = 10`) and covered with unit tests `T2.3d` and `T2.3e`.

### Planned
- **Phase 1: Project Scaffolding & Database Service Layer**
  - Next.js 14+ (App Router) + Tailwind CSS + DaisyUI initialization
  - Database connection pool & DAO for 36K+ Bangkok F&B places and new companion tables
  - Unit tests & API route integration tests for venue search
- **Phase 2: Smart Contracts on Avalanche Fuji**
  - Hardhat setup with Solidity 0.8.24
  - `TasteToken.sol` ($TASTE ERC-20 with mint/burn)
  - `TasteDailyDistributor.sol` (Daily 10,000 $TASTE pool)
  - `TasteChainRegistry.sol` (Pioneer slots 1-3 & Proof hashes)
  - `TasteChainBounty.sol` (AVAX & $TASTE merchant escrow)
  - `TastePromotionEscrow.sol` (80/20 split & deflationary burn)
  - Comprehensive contract test suites & Fuji deployment scripts
- **Phase 3: ElevenLabs AI Voice Studio & Front-Shop QR Oracle**
  - ElevenLabs Multilingual v2 integration for 3 shop greeting voices
  - Web Audio player stream & caching engine
  - Dynamic Front-Shop QR generator & scanner with GPS geofencing (< 100m)
  - Push notification banner & instant audio trigger
- **Phase 4: OpenAI Vision Slip OCR & Proof-of-Visit Pipeline**
  - PromptPay slip OCR API with structured JSON output
  - SHA-256 slip reference deduplication & pHash duplicate photo check
  - On-chain review recorder & pioneer claim logic
- **Phase 5: Token Economics, Merchant Bounties & Circular Promotions**
  - Daily 10,000 $TASTE epoch distribution cron & claim UI
  - Merchant bounty creation & management dashboard
  - Promotion voucher marketplace (199 / 500 $TASTE redemptions)
- **Phase 6: 1-Click Judge Experience & End-to-End Demo Polish**
  - 1-Click Judge Burner Wallet with 0.1 Fuji AVAX auto-drip faucet
  - Pre-filled Bangkok demo venues (Ban That Thong & Ari)
  - Full end-to-end user journey tests

---

## [3.5.0] - 2026-10-15 (Phase 5: Token Economics, Mechanism B Oracle Signatures, & Circular Promotions)

### Added
- **Daily 10,000 $TASTE Pool Emission & Dynamic Pro-Rata Math (`src/lib/services/epoch.ts`)**:
  - Dynamically calculates user reward share based on cumulative points across all participants for that epoch.
  - Guarantees total daily emission sums to exactly 10,000 $TASTE.
- **Mechanism B On-Chain User Claim Oracle (`src/lib/services/claimSignature.ts`)**:
  - Generates EIP-191 ECDSA signatures matching `TasteDailyDistributor.claimReward(epochDate, points, signature)`.
  - Type-safe uint256 conversion for YYYYMMDD epochs.
  - REST endpoint `GET /api/rewards/claim-signature` returning cryptographic signature, reward in Wei, and contract addresses.
  - Persistence of claimed states and transaction hashes in `user_epoch_shares`.
- **Circular Gastronomy Promotions & Deflationary Burn (`src/lib/services/promotions.ts`)**:
  - 199 $TASTE Tier 1 Voucher: 80% to merchant (159.2 $TASTE), 20% deflationary burn (39.8 $TASTE).
  - 500 $TASTE Tier 2 VIP Voucher: 80% to merchant (400 $TASTE), 20% deflationary burn (100 $TASTE).
  - Auto-seeding of promotions in `merchant_promotions` and redemption code generator (`TASTE-XXX-XXXX-XXXX`).
  - REST endpoint `POST /api/promotions/redeem`.
- **Automated Verification Suite (`tests/phase5-tokenomics.test.ts`)**:
  - 11/11 tests passed (100% passing rate):
    - `T5.1`: Single-user and multi-user pro-rata distribution summing to 10,000 $TASTE.
    - `T5.2`: ECDSA cryptographic signature generation and recovery to Oracle address.
    - `T5.3`: Exact 80/20 split and burn verification for 199 and 500 $TASTE vouchers.
    - `T5.4`: On-chain claim state persistence.

---

## [3.4.0] - 2026-10-15 (Phase 4: OpenAI Vision Slip OCR & Proof-of-Visit Pipeline)

### Added
- **OpenAI Vision PromptPay Slip OCR Pipeline (`src/lib/services/slipOcr.ts`)**:
  - Structured extraction of Thai PromptPay bank transfer receipts (SCB, K PLUS, Krungthai NEXT).
  - Extracts numeric amount (THB), sender name, receiver name, transaction date, and reference ID.
  - Generates 32-byte standardized `slip_ref_hash` (`sha256(ref_id)`).
  - Anti-replay fraud detection: strictly blocks reused payment slips across all venues (`DUPLICATE_SLIP`).
- **Food Photo Freshness & Perceptual Hash (`src/lib/services/phash.ts`)**:
  - High-performance perceptual difference hashing (64-bit dHash via `sharp`).
  - Bitwise Hamming distance computation detecting identical or compressed duplicate photo submissions across reviews.
- **Dynamic Activity Points with Pioneer 2x Multiplier (`src/lib/services/reviews.ts`)**:
  - Implemented exact user specification:
    - Food photo (pHash): +1 point
    - Slip OCR < 150 THB: +1 point
    - Slip OCR $\ge 150$ THB: +3 points
    - **Pioneer 2x Multiplier**: If reviewer is confirmed as Pioneer Slot 1, 2, or 3, review points are doubled (e.g. 4 base pts $\rightarrow$ 8 points!).
  - Auto-claims Pioneer slots: First 3 reviewers for any Bangkok venue automatically claim Pioneer Slots #1, #2, and #3 into `pioneer_claims`.
  - Daily review limits: **Max 3 reviews per venue per day** and **Max 10 reviews total per day** across all venues.
- **REST Endpoints & Components**:
  - `POST /api/reviews/submit`: Production endpoint processing verified reviews with pHash, slip OCR, Pioneer slot claims, and shop voice dispatch.
  - `src/components/ReviewModal.tsx`: Interactive review submission modal with live points calculator, Pioneer 2x badge, slip amount toggles, and instant celebratory voice greeting trigger.
- **Automated Verification Suite (`tests/phase4-review-ocr.test.ts`)**:
  - 16/16 tests passed (100% passing rate):
    - `T4.1`: Slip OCR points threshold (<150 THB = 1 pt, $\ge 150$ THB = 3 pts).
    - `T4.2`: Perceptual 64-bit dHash generation and Hamming distance verification.
    - `T4.3`: Pioneer 2x multiplier math (1x for standard users, 2x for Pioneers).
    - `T4.4`: Automatic Pioneer slot claiming for first 3 reviewers and 2x points on subsequent visits.
    - `T4.5`: Anti-replay slip fraud prevention (`DUPLICATE_SLIP`).
    - `T4.6`: Daily review quotas (Max 3/shop/day rejected with 429).

---

## [3.3.0] - 2026-10-15 (Phase 3: ElevenLabs Voice Studio & Front-Shop QR Oracle)

### Added
- **ElevenLabs AI Shop Voice Studio (`src/lib/services/elevenlabs.ts`)**:
  - Multi-persona greeting voice generator for all 36,369 Bangkok F&B venues.
  - Generates 3 distinct greeting slots per venue:
    - Slot 1: *Welcome Host* (Warm Thai greeting welcoming diners).
    - Slot 2: *Chef's Special Recommendation* (House signature dish recommendation).
    - Slot 3: *VIP Patron Gratitude* (Gratitude celebrating TasteChain diners).
  - High-fidelity synthetic WAV audio fallback with multi-tone harmonic chime (C5-E5-G5-C6) ensuring 100% offline & test reliability when API key is unconfigured.
  - Automated pre-seeding pipeline (`ensurePlaceVoices`) and 1-in-3 random voice dispatcher (`dispatchRandomShopVoice`) with live `play_count` tracking.
- **Front-Shop QR Oracle & Geofencing (`src/lib/services/geofence.ts`)**:
  - Haversine distance calculator measuring user distance to venue coordinates.
  - Strict $\le 100\text{m}$ geofence proximity verification rejecting out-of-range scans with HTTP 403 `GEOFENCE_VIOLATION`.
- **Daily Activity Points & 10,000 $TASTE Mining Pool (`src/lib/services/epoch.ts`)**:
  - Front-shop QR check-in awards **3 Daily Activity Points**.
  - Dynamic pro-rata pool calculation: $\text{user\_share} = (\text{user\_pts} / \text{total\_pts}) \times 10,000\text{ \$TASTE}$.
  - Daily rate limit guards: **Max 3 check-ins/venue/day** (HTTP 429 `DAILY_VENUE_LIMIT_EXCEEDED`) and **Max 10 total check-ins/day** (HTTP 429 `DAILY_TOTAL_LIMIT_EXCEEDED`).
- **REST Endpoints**:
  - `POST /api/checkin/qr`: Front-shop QR check-in endpoint validating GPS, awarding 3 points, picking 1-of-3 voices, and recording `in_store_qr_checkins`.
  - `GET /api/merchant/voice`: Venue voice retrieval and auto-seeding endpoint.
  - `POST /api/merchant/voice`: Voice slot customization endpoint for merchant owners.
- **Interactive UI Components**:
  - `src/components/AudioGreetingPlayer.tsx`: Audio player with animated sound wave bars, Thai greeting script, confetti celebration via `canvas-confetti`, and points badge (+3 points).
  - `src/components/QRScannerModal.tsx`: Real-time camera QR scanner using `html5-qrcode` with GPS position acquisition and instant 1-click in-store test check-in.
  - `src/components/FrontShopQRModal.tsx`: Official merchant cashier counter QR code generator with printable display modal and check-in payload.
  - `src/app/place/[placeId]/page.tsx` & `src/components/PlaceDetailClient.tsx`: Venue detail page with Pioneer Honor Roll (Slots 1-3 with 2x point multiplier badge), AI voice preview studio, active promotions, and check-in actions.
- **Automated Verification Suite (`tests/phase3-audio-qr.test.ts`)**:
  - 30/30 tests passed (100% passing rate):
    - `T3.1`: 3 distinct voice slots synthesized, persisted to `shop_voices`, and verified on disk.
    - `T3.2`: Random 1-in-3 dispatch distribution across multiple voice slots and play count tracking.
    - `T3.3`: Haversine geofence verification (0m & 38.9m accepted, 333.6m rejected).
    - `T3.4`: Activity points awarding (+3 pts) and dynamic pro-rata share calculation against 10,000 $TASTE pool.
    - `T3.5`: HTTP API check-in end-to-end (403 for > 100m, 200 with voice dispatch for check-ins 1-3, 429 for 4th check-in).

---

## [3.2.0] - 2026-10-15 (Phase 2: Smart Contracts on Avalanche Fuji)

### Added
- **5 Solidity 0.8.24 Smart Contracts**:
  - `contracts/TasteToken.sol`: Protocol ERC-20 utility token ($TASTE) with minting roles, user burning, and 1,000,000 initial supply.
  - `contracts/TasteDailyDistributor.sol`: Daily 10,000 $TASTE emission pool implementing **Mechanism B (User Claim)** with Oracle ECDSA signature verification.
  - `contracts/TasteChainRegistry.sol`: Gas-optimized Pioneer slot registry (slots 1–3) and anti-replay slip deduplication via `keccak256(placeId)`.
  - `contracts/TasteChainBounty.sol`: Multi-asset merchant escrow supporting both native AVAX and $TASTE token bounties with direct reviewer payouts.
  - `contracts/TastePromotionEscrow.sol`: Circular gastronomy promotion escrow enforcing an 80% merchant transfer and a 20% deflationary burn to dead address (`0x0...dEaD`).
- **Hardhat 2.22 Tooling & Config**:
  - `hardhat.config.js`: Configured for Solidity 0.8.24 with optimizer (200 runs) and Avalanche Fuji Testnet RPC.
  - `scripts/deploy-fuji.js`: Full deployment pipeline deploying all 5 contracts, granting minter roles, and exporting JSON artifacts.
- **Contract Abstraction Layer**:
  - `src/config/contracts.ts`: Type-safe contract addresses, ABIs, and Avalanche Fuji network definitions.
  - `src/config/contracts.json`: Deployment addresses artifact.
- **Automated Verification Suite (`test/TasteContracts.test.js`)**:
  - 12/12 tests passed (100% passing rate):
    - `T2.1`: Initial 1M $TASTE mint, authorized minter control, and user token burning.
    - `T2.2`: Daily 10K pool finalization, pro-rata claim calculation with Oracle signature, and duplicate claim rejection.
    - `T2.3`: Pioneer slot assignment (slots 1, 2, 3 assigned; 4th rejected), slip hash replay rejection, and rating boundaries.
    - `T2.4`: Merchant native AVAX and $TASTE token funding and claim execution.
    - `T2.5`: Promotion redemption with exact 80% merchant transfer and 20% dead address burn.

---

## [3.1.0] - 2026-10-15 (Phase 1: Project Scaffolding & Database Service Layer)

### Added
- **Frontend & App Scaffolding**:
  - Next.js 14 App Router project with React 18, TypeScript, Tailwind CSS v3.4, and DaisyUI v4.
  - Custom branding colors: Avalanche Red (`#E84142`), Gastronomy Gold (`#F59E0B`), and Verified Green (`#10B981`).
  - Responsive Navbar with Judge Demo button, logo branding, and responsive layout.
- **PostgreSQL Database Service Layer**:
  - `src/lib/db.ts`: Robust connection pool using `pg.Pool` connected to `uhack-postgres:5432` (`tastechain`).
  - `src/lib/services/places.ts`: Query engine for 36,369 operational Bangkok F&B venues with multi-criteria filtering (search `q`, `service_type`, `min_rating`, `has_bounty`, `pioneer_open`, bounding boxes, and pagination).
  - Subquery aggregates for Pioneer slot claims (0–3), active AVAX & $TASTE merchant bounties, and active promotions.
  - `getBangkokStats()` helper for protocol-wide real-time metrics.
- **REST API Routes**:
  - `GET /api/places`: Dynamic search and filter API with pagination.
  - `GET /api/places/[placeId]`: Detailed place profile API with pioneer slots, reviews, active promotions, and voice slots.
- **Home Page (`src/app/page.tsx`)**:
  - Hero banner with live Bangkok F&B metrics (36,369 venues, 10,000 $TASTE daily pool).
  - Search input with category badges (`All`, `Restaurant`, `Cafe`, `Bar`, `Bakery`, `Noodle`, `Thai`).
  - Quick filter pills (`⚡ Active Bounty`, `🏆 Pioneer Open`, `⭐ 4.5+`).
  - Venue card grid with pioneer badges, rating, address, and review action links.
- **Automated Verification Suite (`tests/phase1-places.test.ts`)**:
  - 7/7 tests passed:
    - `T1.1`: PostgreSQL connection pool connects in 27ms.
    - `T1.2`: Bangkok operational F&B venues verified at 36,369 places.
    - `T1.3`: Search query latency verified at 171ms (< 300ms threshold).
    - `T1.4`: Category filter returns 100% matching venues.
    - `T1.5`: Place detail retrieval loads all companion relations.
- **Production Build**: Verified `npm run build` compiles with 0 errors and 0 warnings.

---

## [3.0.0] - 2026-10-15

### Added
- **Product Requirements Document (PRD v3.0.0)**:
  - ElevenLabs AI Shop Greeting Voices (3 voice slots with random dispatch).
  - Front-Shop QR Proof-of-Visit with instant push notification and audio playback.
  - $TASTE Protocol Utility Token with Daily 10,000 Emission Pool (Mining Game Theory).
  - Merchant $TASTE Bounty Campaigns (e.g., 100K tokens for 30 days).
  - Merchant Promotions (199 $TASTE free dish, 500 $TASTE 15% discount) with 80% merchant payout and 20% deflationary burn.
  - Dual Proof-of-Visit Architecture (Cashier QR + PromptPay Slip OCR).
- **PostgreSQL Database Schema Migration**:
  - Migrated 7 new companion tables in `uhack-postgres` (`tastechain` database):
    - `shop_voices`
    - `in_store_qr_checkins`
    - `daily_token_epochs`
    - `user_epoch_shares`
    - `merchant_token_bounties`
    - `merchant_promotions`
    - `promotion_redemptions`
- **Project Infrastructure**:
  - Initialized Git repository targeting `https://github.com/0xta/Uhackathon2026`.
  - Added `.gitignore` and `CHANGELOG.md`.
  - Added detailed 6-phase implementation and verification plan in `IMPLEMENTATION_PLAN.md`.
- **Tokenomics Specification Rules**:
  - Defined Daily Activity Points: Front-shop QR scan = 3 pts, Food photo (pHash) = 1 pt, Receipt OCR (< 150 THB = 1 pt, >= 150 THB = 3 pts).
  - Selected Token Distribution Mechanism B: User-initiated Daily Claim via Web3 transaction on `TasteDailyDistributor.sol`.
  - Updated PostgreSQL column defaults (`in_store_qr_checkins.epoch_points_awarded` default 3, `verified_reviews.epoch_points_awarded`).
