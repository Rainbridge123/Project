const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

function toBytes32(str) { return ethers.encodeBytes32String(str); }
function eth(n) { return ethers.parseEther(String(n)); }

async function deployFixture() {
  const [owner, passenger, underwriter] = await ethers.getSigners();
  const Core = await ethers.getContractFactory("SkyHedgeCoreChainlink");
  const core = await Core.deploy(owner.address);
  await core.waitForDeployment();
  await core.connect(owner).setOracleCoordinator(owner.address);
  return { core, owner, passenger, underwriter };
}

async function createActivePolicy(core, passenger, underwriter) {
  const now = await time.latest();
  const params = {
    flightRef: toBytes32("SQ322"),
    departureTime: now + 3600,
    delayThreshold: 60,
    fixedPayout: eth(0.5),
    maxPremium: eth(0.05),
    auctionEnd: now + 60,
    expiry: now + 86400,
  };

  await core.connect(passenger).createPolicy(
    params.flightRef,
    params.departureTime,
    params.delayThreshold,
    params.fixedPayout,
    params.auctionEnd,
    params.expiry,
    { value: params.maxPremium }
  );
  await core.connect(underwriter).bidPremium(1, eth(0.02));
  await time.increaseTo(params.auctionEnd + 1);
  await core.connect(underwriter).finalizeAuction(1, { value: params.fixedPayout });
  return params;
}

describe("SkyHedgeCoreChainlink", function () {
  it("only allows the configured coordinator to settle", async function () {
    const { core, passenger, underwriter } = await deployFixture();
    await createActivePolicy(core, passenger, underwriter);

    await expect(
      core.connect(passenger).resolvePolicyFromOracle(1, 120)
    ).to.be.revertedWith("Only coordinator can call this");
  });

  it("rejects settlement before departure time plus threshold", async function () {
    const { core, owner, passenger, underwriter } = await deployFixture();
    const params = await createActivePolicy(core, passenger, underwriter);

    await expect(
      core.connect(owner).resolvePolicyFromOracle(1, 120)
    ).to.be.revertedWith("Settlement window not reached");

    await time.increaseTo(params.departureTime + (params.delayThreshold * 60) + 1);

    await expect(core.connect(owner).resolvePolicyFromOracle(1, 120))
      .to.emit(core, "PolicyResolved");
  });
});
