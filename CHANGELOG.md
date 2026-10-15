# Changelog

All notable changes to the **TasteChain BKK** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
