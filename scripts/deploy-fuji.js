const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=================================================");
  console.log("   TASTECHAIN BKK — AVALANCHE FUJI DEPLOYMENT   ");
  console.log("=================================================\n");

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deployer Address : ${deployer.address}`);
  console.log(`AVAX Balance     : ${ethers.formatEther(balance)} AVAX`);
  console.log(`Network Name     : ${hre.network.name}`);
  console.log(`Chain ID         : ${(await ethers.provider.getNetwork()).chainId}\n`);

  const oracleAddress = process.env.ORACLE_ADDRESS || deployer.address;
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;

  // 1. Deploy TasteToken
  console.log("1. Deploying TasteToken ($TASTE ERC-20)...");
  const TasteToken = await ethers.getContractFactory("TasteToken");
  const tasteToken = await TasteToken.deploy();
  await tasteToken.waitForDeployment();
  const tokenAddress = await tasteToken.getAddress();
  console.log(`   └─ TasteToken deployed at: ${tokenAddress}`);

  // 2. Deploy TasteDailyDistributor
  console.log("\n2. Deploying TasteDailyDistributor (Daily 10K Pool Vault)...");
  const Distributor = await ethers.getContractFactory("TasteDailyDistributor");
  const distributor = await Distributor.deploy(tokenAddress, oracleAddress);
  await distributor.waitForDeployment();
  const distributorAddress = await distributor.getAddress();
  console.log(`   └─ TasteDailyDistributor deployed at: ${distributorAddress}`);

  // Authorize Distributor as minter
  console.log("   └─ Authorizing Distributor as minter on TasteToken...");
  const setMinterTx = await tasteToken.setMinter(distributorAddress, true);
  await setMinterTx.wait();
  console.log("   └─ Distributor minter role granted!");

  // 3. Deploy TasteChainRegistry
  console.log("\n3. Deploying TasteChainRegistry (Pioneers & Proof Deduplication)...");
  const Registry = await ethers.getContractFactory("TasteChainRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`   └─ TasteChainRegistry deployed at: ${registryAddress}`);

  // 4. Deploy TasteChainBounty
  console.log("\n4. Deploying TasteChainBounty (Merchant Escrow)...");
  const Bounty = await ethers.getContractFactory("TasteChainBounty");
  const bounty = await Bounty.deploy(treasuryAddress, oracleAddress, tokenAddress);
  await bounty.waitForDeployment();
  const bountyAddress = await bounty.getAddress();
  console.log(`   └─ TasteChainBounty deployed at: ${bountyAddress}`);

  // 5. Deploy TastePromotionEscrow
  console.log("\n5. Deploying TastePromotionEscrow (Circular Voucher 80/20 Burn)...");
  const Promo = await ethers.getContractFactory("TastePromotionEscrow");
  const promo = await Promo.deploy(tokenAddress);
  await promo.waitForDeployment();
  const promoAddress = await promo.getAddress();
  console.log(`   └─ TastePromotionEscrow deployed at: ${promoAddress}`);

  // Save deployment artifact
  const deployedConfig = {
    network: hre.network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      TasteToken: tokenAddress,
      TasteDailyDistributor: distributorAddress,
      TasteChainRegistry: registryAddress,
      TasteChainBounty: bountyAddress,
      TastePromotionEscrow: promoAddress,
    },
  };

  const configPath = path.join(__dirname, "../src/config/contracts.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(deployedConfig, null, 2));

  console.log("\n=================================================");
  console.log("DEPLOYMENT COMPLETE! Saved to src/config/contracts.json");
  console.log("=================================================\n");
  console.log("Paste into your .env.local:");
  console.log(`NEXT_PUBLIC_TASTE_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_DAILY_DISTRIBUTOR_ADDRESS=${distributorAddress}`);
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`NEXT_PUBLIC_BOUNTY_ADDRESS=${bountyAddress}`);
  console.log(`NEXT_PUBLIC_PROMOTION_ESCROW_ADDRESS=${promoAddress}\n`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
