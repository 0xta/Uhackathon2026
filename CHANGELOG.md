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
