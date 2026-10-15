const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TasteChain Smart Contracts Suite", function () {
  let owner, oracle, merchant, reviewer1, reviewer2, reviewer3, reviewer4;
  let tasteToken, dailyDistributor, registry, bountyContract, promoEscrow;

  const PLACE_ID = "ChIJ4zMgS2WZ4jARz4uaJRdFWg4";
  const PLACE_HASH = ethers.keccak256(ethers.toUtf8Bytes(PLACE_ID));

  beforeEach(async function () {
    [owner, oracle, merchant, reviewer1, reviewer2, reviewer3, reviewer4] = await ethers.getSigners();

    // 1. Deploy TasteToken
    const TasteTokenFactory = await ethers.getContractFactory("TasteToken");
    tasteToken = await TasteTokenFactory.deploy();
    await tasteToken.waitForDeployment();

    // 2. Deploy TasteDailyDistributor
    const DistributorFactory = await ethers.getContractFactory("TasteDailyDistributor");
    dailyDistributor = await DistributorFactory.deploy(await tasteToken.getAddress(), oracle.address);
    await dailyDistributor.waitForDeployment();

    // Authorize DailyDistributor as minter on TasteToken
    await tasteToken.setMinter(await dailyDistributor.getAddress(), true);

    // 3. Deploy TasteChainRegistry
    const RegistryFactory = await ethers.getContractFactory("TasteChainRegistry");
    registry = await RegistryFactory.deploy();
    await registry.waitForDeployment();

    // 4. Deploy TasteChainBounty
    const BountyFactory = await ethers.getContractFactory("TasteChainBounty");
    bountyContract = await BountyFactory.deploy(
      owner.address, // protocolTreasury
      oracle.address,
      await tasteToken.getAddress()
    );
    await bountyContract.waitForDeployment();

    // 5. Deploy TastePromotionEscrow
    const PromoFactory = await ethers.getContractFactory("TastePromotionEscrow");
    promoEscrow = await PromoFactory.deploy(await tasteToken.getAddress());
    await promoEscrow.waitForDeployment();
  });

  // =========================================================================
  // 1. TasteToken Tests
  // =========================================================================
  describe("TasteToken ($TASTE ERC-20)", function () {
    it("T2.1a: Should mint initial 1,000,000 TASTE to deployer", async function () {
      const balance = await tasteToken.balanceOf(owner.address);
      expect(balance).to.equal(ethers.parseEther("1000000"));
    });

    it("T2.1b: Authorized minter can mint, unauthorized cannot", async function () {
      await tasteToken.setMinter(merchant.address, true);
      await tasteToken.connect(merchant).mint(reviewer1.address, ethers.parseEther("500"));
      expect(await tasteToken.balanceOf(reviewer1.address)).to.equal(ethers.parseEther("500"));

      await expect(
        tasteToken.connect(reviewer2).mint(reviewer2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Not authorized minter");
    });

    it("T2.1c: User can burn their own tokens", async function () {
      await tasteToken.transfer(reviewer1.address, ethers.parseEther("100"));
      await tasteToken.connect(reviewer1).burn(ethers.parseEther("40"));
      expect(await tasteToken.balanceOf(reviewer1.address)).to.equal(ethers.parseEther("60"));
    });
  });

  // =========================================================================
  // 2. TasteDailyDistributor Tests (Mechanism B)
  // =========================================================================
  describe("TasteDailyDistributor (Daily 10K Pool & Mechanism B)", function () {
    const DAY_INDEX = 20261015;

    it("T2.2a: Only oracle can finalize epoch", async function () {
      await expect(
        dailyDistributor.connect(reviewer1).finalizeEpoch(DAY_INDEX, 500)
      ).to.be.revertedWith("Caller is not the oracle");

      await expect(dailyDistributor.connect(oracle).finalizeEpoch(DAY_INDEX, 500))
        .to.emit(dailyDistributor, "EpochFinalized")
        .withArgs(DAY_INDEX, 500, ethers.parseEther("10000"));
    });

    it("T2.2b: User claims pro-rata reward with valid oracle signature", async function () {
      // Finalize epoch with total 100 points
      await dailyDistributor.connect(oracle).finalizeEpoch(DAY_INDEX, 100);

      // Reviewer1 has 25 points (e.g. Pioneer 2x multiplier applied)
      const userPoints = 25;
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await dailyDistributor.getAddress();

      // Sign authorization as Oracle
      const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "address", "uint256", "uint256", "address"],
        [DAY_INDEX, reviewer1.address, userPoints, chainId, contractAddress]
      );
      const signature = await oracle.signMessage(ethers.getBytes(messageHash));

      // User claims reward
      const expectedReward = ethers.parseEther("2500"); // (25 / 100) * 10,000 = 2,500 TASTE
      await expect(
        dailyDistributor.connect(reviewer1).claimReward(DAY_INDEX, userPoints, signature)
      )
        .to.emit(dailyDistributor, "RewardClaimed")
        .withArgs(DAY_INDEX, reviewer1.address, userPoints, expectedReward);

      expect(await tasteToken.balanceOf(reviewer1.address)).to.equal(expectedReward);

      // Cannot claim twice
      await expect(
        dailyDistributor.connect(reviewer1).claimReward(DAY_INDEX, userPoints, signature)
      ).to.be.revertedWith("Reward already claimed for this day");
    });

    it("T2.2c: Rejects claim with forged signature or incorrect points", async function () {
      await dailyDistributor.connect(oracle).finalizeEpoch(DAY_INDEX, 100);

      // Sign with non-oracle key (attacker)
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const contractAddress = await dailyDistributor.getAddress();
      const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "address", "uint256", "uint256", "address"],
        [DAY_INDEX, reviewer2.address, 50, chainId, contractAddress]
      );
      const fakeSignature = await reviewer1.signMessage(ethers.getBytes(messageHash));

      await expect(
        dailyDistributor.connect(reviewer2).claimReward(DAY_INDEX, 50, fakeSignature)
      ).to.be.revertedWith("Invalid oracle signature");
    });
  });

  // =========================================================================
  // 3. TasteChainRegistry Tests (Pioneer Slots 1-3 & Slip Deduplication)
  // =========================================================================
  describe("TasteChainRegistry (Pioneer Slots & Anti-Replay)", function () {
    const SLIP_1 = ethers.keccak256(ethers.toUtf8Bytes("SLIP_REF_001"));
    const SLIP_2 = ethers.keccak256(ethers.toUtf8Bytes("SLIP_REF_002"));
    const SLIP_3 = ethers.keccak256(ethers.toUtf8Bytes("SLIP_REF_003"));
    const SLIP_4 = ethers.keccak256(ethers.toUtf8Bytes("SLIP_REF_004"));

    it("T2.3a: First 3 reviewers get Pioneer slots 1, 2, 3; 4th does not", async function () {
      // Reviewer 1 -> Slot 1
      const tx1 = await registry.connect(reviewer1).recordReview(PLACE_HASH, SLIP_1, 5);
      await expect(tx1).to.emit(registry, "PioneerRegistered").withArgs(PLACE_HASH, reviewer1.address, 1);

      // Reviewer 2 -> Slot 2
      const tx2 = await registry.connect(reviewer2).recordReview(PLACE_HASH, SLIP_2, 4);
      await expect(tx2).to.emit(registry, "PioneerRegistered").withArgs(PLACE_HASH, reviewer2.address, 2);

      // Reviewer 3 -> Slot 3
      const tx3 = await registry.connect(reviewer3).recordReview(PLACE_HASH, SLIP_3, 5);
      await expect(tx3).to.emit(registry, "PioneerRegistered").withArgs(PLACE_HASH, reviewer3.address, 3);

      // Reviewer 4 -> Regular review (isPioneer = false, slot = 0)
      const tx4 = await registry.connect(reviewer4).recordReview(PLACE_HASH, SLIP_4, 4);
      await expect(tx4).to.not.emit(registry, "PioneerRegistered");

      const [pioneers, count] = await registry.getPioneers(PLACE_HASH);
      expect(count).to.equal(3);
      expect(pioneers[0]).to.equal(reviewer1.address);
      expect(pioneers[1]).to.equal(reviewer2.address);
      expect(pioneers[2]).to.equal(reviewer3.address);

      const [pCount, totalReviews] = await registry.getPlaceInfo(PLACE_HASH);
      expect(pCount).to.equal(3);
      expect(totalReviews).to.equal(4);
    });

    it("T2.3b: Reused slip hash is rejected", async function () {
      await registry.connect(reviewer1).recordReview(PLACE_HASH, SLIP_1, 5);
      await expect(
        registry.connect(reviewer2).recordReview(PLACE_HASH, SLIP_1, 5)
      ).to.be.revertedWith("Slip reference has already been used");
    });

    it("T2.3c: Rating must be between 1 and 5", async function () {
      await expect(
        registry.connect(reviewer1).recordReview(PLACE_HASH, SLIP_1, 0)
      ).to.be.revertedWith("Invalid rating: must be 1 to 5");

      await expect(
        registry.connect(reviewer1).recordReview(PLACE_HASH, SLIP_1, 6)
      ).to.be.revertedWith("Invalid rating: must be 1 to 5");
    });
  });

  // =========================================================================
  // 4. TasteChainBounty Tests (AVAX & $TASTE Escrow)
  // =========================================================================
  describe("TasteChainBounty (Merchant Escrow)", function () {
    it("T2.4a: Merchant funds and oracle claims native AVAX bounty", async function () {
      const deposit = ethers.parseEther("1.0");
      const rewardPerVisit = ethers.parseEther("0.1");

      await bountyContract.connect(merchant).fundAvaxBounty(PLACE_HASH, rewardPerVisit, { value: deposit });
      const info = await bountyContract.getBountyInfo(PLACE_HASH);
      expect(info.remainingFunds).to.equal(deposit);
      expect(info.active).to.be.true;

      // Oracle triggers claim for reviewer1
      const initialBalance = await ethers.provider.getBalance(reviewer1.address);
      await expect(bountyContract.connect(oracle).claimReward(PLACE_HASH, reviewer1.address))
        .to.emit(bountyContract, "RewardPaid")
        .withArgs(PLACE_HASH, reviewer1.address, rewardPerVisit, false);

      const newBalance = await ethers.provider.getBalance(reviewer1.address);
      expect(newBalance - initialBalance).to.equal(rewardPerVisit);
    });

    it("T2.4b: Merchant funds and oracle claims $TASTE token bounty", async function () {
      const deposit = ethers.parseEther("50000"); // 50,000 TASTE
      const rewardPerVisit = ethers.parseEther("100"); // 100 TASTE per review

      // Transfer tokens to merchant and approve
      await tasteToken.transfer(merchant.address, deposit);
      await tasteToken.connect(merchant).approve(await bountyContract.getAddress(), deposit);

      await bountyContract.connect(merchant).fundTokenBounty(PLACE_HASH, deposit, rewardPerVisit);
      const info = await bountyContract.getBountyInfo(PLACE_HASH);
      expect(info.remainingFunds).to.equal(deposit);
      expect(info.isToken).to.be.true;

      // Oracle triggers claim
      await bountyContract.connect(oracle).claimReward(PLACE_HASH, reviewer1.address);
      expect(await tasteToken.balanceOf(reviewer1.address)).to.equal(rewardPerVisit);
    });
  });

  // =========================================================================
  // 5. TastePromotionEscrow Tests (80% Merchant / 20% Burn)
  // =========================================================================
  describe("TastePromotionEscrow (Circular Economy & 80/20 Burn)", function () {
    const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

    it("T2.5: Redeems 500 TASTE promotion: 400 to merchant (80%), 100 burned (20%)", async function () {
      const promoCost = ethers.parseEther("500");
      const merchantShare = ethers.parseEther("400"); // 80%
      const burnShare = ethers.parseEther("100");     // 20%

      // Give reviewer1 500 TASTE and approve escrow
      await tasteToken.transfer(reviewer1.address, promoCost);
      await tasteToken.connect(reviewer1).approve(await promoEscrow.getAddress(), promoCost);

      const initialMerchantBalance = await tasteToken.balanceOf(merchant.address);
      const initialDeadBalance = await tasteToken.balanceOf(DEAD_ADDRESS);

      await expect(
        promoEscrow.connect(reviewer1).redeemPromotion(PLACE_HASH, merchant.address, promoCost, "PROMO_DISCOUNT_15")
      )
        .to.emit(promoEscrow, "PromotionRedeemed")
        .withArgs(
          PLACE_HASH,
          reviewer1.address,
          merchant.address,
          promoCost,
          merchantShare,
          burnShare,
          "PROMO_DISCOUNT_15"
        );

      expect(await tasteToken.balanceOf(merchant.address) - initialMerchantBalance).to.equal(merchantShare);
      expect(await tasteToken.balanceOf(DEAD_ADDRESS) - initialDeadBalance).to.equal(burnShare);
      expect(await tasteToken.balanceOf(reviewer1.address)).to.equal(0);
    });
  });
});
