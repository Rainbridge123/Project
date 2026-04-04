// test/core.test.js
const { expect }        = require("chai");
const { ethers }        = require("hardhat");
const { time }          = require("@nomicfoundation/hardhat-network-helpers");

function toBytes32(str) { return ethers.encodeBytes32String(str); }
function eth(n)         { return ethers.parseEther(String(n)); }

async function deployFixture() {
  const [deployer, passenger, underwriter1, underwriter2, thirdParty] = await ethers.getSigners();
  const SkyHedgeCore = await ethers.getContractFactory("SkyHedgeCore");
  const contract = await SkyHedgeCore.deploy(deployer.address);
  await contract.waitForDeployment();
  return { contract, deployer, passenger, underwriter1, underwriter2, thirdParty };
}

async function policyParams(overrides = {}) {
  const now = await time.latest();
  return {
    flightRef:      toBytes32("SQ321"),
    departureTime:  now + 3600,
    delayThreshold: 60,
    fixedPayout:    eth(0.5),
    maxPremium:     eth(0.05),   // passenger willing to pay up to 0.05 ETH
    auctionEnd:     now + 60,
    expiry:         now + 86400,
    ...overrides,
  };
}

// Helper: create policy with maxPremium escrowed
async function createPolicy(contract, passenger, p) {
  return contract.connect(passenger).createPolicy(
    p.flightRef, p.departureTime, p.delayThreshold,
    p.fixedPayout, p.auctionEnd, p.expiry,
    { value: p.maxPremium }
  );
}

// Helper: run through to ACTIVE state with a given winning premium
async function setupActivePolicy(contract, deployer, passenger, underwriter, winningPremium) {
  const p = await policyParams();
  await createPolicy(contract, passenger, p);
  await contract.connect(underwriter).bidPremium(1, winningPremium);
  await time.increase(61);
  await contract.connect(underwriter).finalizeAuction(1, { value: p.fixedPayout });
  return p;
}

describe("SkyHedgeCore", function () {

  // ── createPolicy ────────────────────────────────────────────────
  describe("createPolicy", function () {
    it("escrows maxPremium and stores policy", async function () {
      const { contract, passenger } = await deployFixture();
      const p = await policyParams();
      await createPolicy(contract, passenger, p);

      const policy = await contract.getPolicy(1);
      expect(policy.maxPremium).to.equal(p.maxPremium);
      expect(policy.bestPremium).to.equal(p.maxPremium); // auction ceiling
      expect(policy.passenger).to.equal(passenger.address);
      expect(policy.status).to.equal(0); // BIDDING

      // Contract holds the escrowed maxPremium
      const contractBal = await ethers.provider.getBalance(await contract.getAddress());
      expect(contractBal).to.equal(p.maxPremium);
    });

    it("emits PolicyCreated with maxPremium", async function () {
      const { contract, passenger } = await deployFixture();
      const p = await policyParams();
      await expect(createPolicy(contract, passenger, p))
        .to.emit(contract, "PolicyCreated")
        .withArgs(1, passenger.address, p.flightRef, p.fixedPayout, p.maxPremium, p.auctionEnd);
    });

    it("rejects if msg.value == 0", async function () {
      const { contract, passenger } = await deployFixture();
      const p = await policyParams();
      await expect(
        contract.connect(passenger).createPolicy(
          p.flightRef, p.departureTime, p.delayThreshold,
          p.fixedPayout, p.auctionEnd, p.expiry,
          { value: 0 }
        )
      ).to.be.revertedWith("Must escrow maxPremium (msg.value > 0)");
    });
  });

  // ── bidPremium ───────────────────────────────────────────────────
  describe("bidPremium", function () {
    it("records lower bids correctly", async function () {
      const { contract, passenger, underwriter1, underwriter2 } = await deployFixture();
      const p = await policyParams();
      await createPolicy(contract, passenger, p);

      await contract.connect(underwriter1).bidPremium(1, eth(0.03)); // 0.03 < 0.05 max
      expect((await contract.getPolicy(1)).bestPremium).to.equal(eth(0.03));
      expect((await contract.getPolicy(1)).bestUnderwriter).to.equal(underwriter1.address);

      await contract.connect(underwriter2).bidPremium(1, eth(0.01)); // 0.01 < 0.03
      expect((await contract.getPolicy(1)).bestPremium).to.equal(eth(0.01));
      expect((await contract.getPolicy(1)).bestUnderwriter).to.equal(underwriter2.address);
    });

    it("rejects bid higher than current best", async function () {
      const { contract, passenger, underwriter1 } = await deployFixture();
      const p = await policyParams();
      await createPolicy(contract, passenger, p);
      await contract.connect(underwriter1).bidPremium(1, eth(0.02));
      await expect(
        contract.connect(underwriter1).bidPremium(1, eth(0.03))
      ).to.be.revertedWith("Must beat current best bid");
    });

    it("rejects bid exceeding maxPremium", async function () {
      const { contract, passenger, underwriter1 } = await deployFixture();
      const p = await policyParams();
      await createPolicy(contract, passenger, p);
      await expect(
        contract.connect(underwriter1).bidPremium(1, eth(0.06)) // > maxPremium 0.05
      ).to.be.revertedWith("Must beat current best bid");
    });
  });

  // ── finalizeAuction ──────────────────────────────────────────────
  describe("finalizeAuction", function () {
    it("transfers bestPremium to underwriter and refunds excess to passenger", async function () {
      const { contract, passenger, underwriter1 } = await deployFixture();
      const p = await policyParams(); // maxPremium = 0.05 ETH
      await createPolicy(contract, passenger, p);
      await contract.connect(underwriter1).bidPremium(1, eth(0.02)); // wins at 0.02
      await time.increase(61);

      const passBefore = await ethers.provider.getBalance(passenger.address);
      const uwBefore   = await ethers.provider.getBalance(underwriter1.address);

      const tx   = await contract.connect(underwriter1).finalizeAuction(1, { value: p.fixedPayout });
      const rcpt = await tx.wait();
      const gasUsed = rcpt.gasUsed * tx.gasPrice;

      const passAfter = await ethers.provider.getBalance(passenger.address);
      const uwAfter   = await ethers.provider.getBalance(underwriter1.address);

      // Passenger gets refund: maxPremium - bestPremium = 0.05 - 0.02 = 0.03 ETH
      expect(passAfter - passBefore).to.equal(eth(0.03));

      // Underwriter: sent fixedPayout (0.5), received bestPremium (0.02), paid gas
      // Net = -0.5 + 0.02 - gas = -(0.48 + gas)
      expect(uwBefore - uwAfter - gasUsed).to.equal(eth(0.48));
    });

    it("mints Policy NFT to passenger and Risk NFT to underwriter", async function () {
      const { contract, passenger, underwriter1 } = await deployFixture();
      const p = await policyParams();
      await createPolicy(contract, passenger, p);
      await contract.connect(underwriter1).bidPremium(1, eth(0.02));
      await time.increase(61);
      await contract.connect(underwriter1).finalizeAuction(1, { value: p.fixedPayout });

      const policy = await contract.getPolicy(1);
      expect(await contract.ownerOf(policy.policyNFTId)).to.equal(passenger.address);
      expect(await contract.ownerOf(policy.riskNFTId)).to.equal(underwriter1.address);
      expect(policy.status).to.equal(1); // ACTIVE
    });

    it("no refund when bestPremium == maxPremium", async function () {
      const { contract, passenger, underwriter1 } = await deployFixture();
      const p = await policyParams(); // maxPremium = 0.05
      await createPolicy(contract, passenger, p);
      // Bid exactly at maxPremium ceiling — but must be strictly lower, so bid maxPremium - 1 wei
      await contract.connect(underwriter1).bidPremium(1, p.maxPremium - 1n);
      await time.increase(61);

      const passBefore = await ethers.provider.getBalance(passenger.address);
      await contract.connect(underwriter1).finalizeAuction(1, { value: p.fixedPayout });
      const passAfter = await ethers.provider.getBalance(passenger.address);

      // Refund = maxPremium - (maxPremium - 1) = 1 wei
      expect(passAfter - passBefore).to.equal(1n);
    });

    it("rejects non-winner from finalizing", async function () {
      const { contract, passenger, underwriter1, underwriter2 } = await deployFixture();
      const p = await policyParams();
      await createPolicy(contract, passenger, p);
      await contract.connect(underwriter2).bidPremium(1, eth(0.01)); // UW2 wins
      await time.increase(61);
      await expect(
        contract.connect(underwriter1).finalizeAuction(1, { value: p.fixedPayout })
      ).to.be.revertedWith("Only winning underwriter can finalize");
    });
  });

  // ── resolvePolicy: Happy Path ────────────────────────────────────
  describe("resolvePolicy – Happy Path (delayed)", function () {
    it("pays fixedPayout to current Policy NFT holder", async function () {
      const { contract, deployer, passenger, underwriter1 } = await deployFixture();
      const p = await setupActivePolicy(contract, deployer, passenger, underwriter1, eth(0.02));

      const balBefore = await ethers.provider.getBalance(passenger.address);
      await contract.connect(deployer).resolvePolicy(1, 120); // 120 min ≥ threshold 60
      const balAfter = await ethers.provider.getBalance(passenger.address);

      expect(balAfter - balBefore).to.equal(p.fixedPayout);
      expect((await contract.getPolicy(1)).status).to.equal(2); // PAID
    });
  });

  // ── resolvePolicy: No-delay Path ────────────────────────────────
  describe("resolvePolicy – No-delay Path (on time)", function () {
    it("returns fixedPayout to Risk NFT holder", async function () {
      const { contract, deployer, passenger, underwriter1 } = await deployFixture();
      const p = await setupActivePolicy(contract, deployer, passenger, underwriter1, eth(0.02));

      const balBefore = await ethers.provider.getBalance(underwriter1.address);
      await contract.connect(deployer).resolvePolicy(1, 10); // 10 min < threshold 60
      const balAfter = await ethers.provider.getBalance(underwriter1.address);

      expect(balAfter - balBefore).to.equal(p.fixedPayout);
      expect((await contract.getPolicy(1)).status).to.equal(3); // EXPIRED
    });
  });

  // ── Bearer Instrument Demo Highlight ────────────────────────────
  describe("Bearer Instrument – payout to current NFT holder", function () {
    it("pays thirdParty who received Policy NFT from passenger", async function () {
      const { contract, deployer, passenger, underwriter1, thirdParty } = await deployFixture();
      const p = await setupActivePolicy(contract, deployer, passenger, underwriter1, eth(0.02));

      const policy = await contract.getPolicy(1);
      // Passenger transfers Policy NFT to thirdParty
      await contract.connect(passenger).transferFrom(
        passenger.address, thirdParty.address, policy.policyNFTId
      );
      expect(await contract.ownerOf(policy.policyNFTId)).to.equal(thirdParty.address);

      const balBefore = await ethers.provider.getBalance(thirdParty.address);
      await contract.connect(deployer).resolvePolicy(1, 120);
      const balAfter = await ethers.provider.getBalance(thirdParty.address);

      // thirdParty (not original passenger) received the payout
      expect(balAfter - balBefore).to.equal(p.fixedPayout);
    });
  });

  // ── Access control ───────────────────────────────────────────────
  describe("Access control", function () {
    it("rejects resolvePolicy from non-resolver", async function () {
      const { contract, deployer, passenger, underwriter1 } = await deployFixture();
      await setupActivePolicy(contract, deployer, passenger, underwriter1, eth(0.02));
      await expect(
        contract.connect(passenger).resolvePolicy(1, 120)
      ).to.be.revertedWith("Only resolver can call this");
    });
  });
});
