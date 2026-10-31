// Tests for updateStatus, getBatch and getHistory.
const { expect } = require("chai");
const { ethers } = require("hardhat");

// same order as the enums in IFreshTrace.sol
const Role = { None: 0, Farmer: 1, Packer: 2, Carrier: 3, DistributionCenter: 4, Retailer: 5, Regulator: 6, Sensor: 7 };
const Status = { Harvested: 0, Packed: 1, InTransit: 2, AtDistributionCenter: 3, AtRetailer: 4 };

describe("FreshTrace - status and views", function () {
  let freshTrace, admin, farmer, packer, carrier, outsider;
  const cid = "bafyTestCID";

  beforeEach(async function () {
    [admin, farmer, packer, carrier, outsider] = await ethers.getSigners();
    freshTrace = await ethers.deployContract("FreshTrace");

    // give each test wallet its role (admin is account 0, the deployer)
    await freshTrace.setRole(farmer.address, Role.Farmer);
    await freshTrace.setRole(packer.address, Role.Packer);
    await freshTrace.setRole(carrier.address, Role.Carrier);

    // one batch for every test: lettuce, 100 kg, safe range 2.0 to 8.0 C
    await freshTrace.connect(farmer).registerBatch("Lettuce", 100, 20, 80, cid);
  });

  // Status moves forward one step at a time and emits StatusUpdated
  it("holder moves the status forward", async function () {
    await freshTrace.connect(farmer).transferCustody(1, packer.address);
    await expect(freshTrace.connect(packer).updateStatus(1, Status.Packed))
      .to.emit(freshTrace, "StatusUpdated")
      .withArgs(1, Status.Packed);

    await freshTrace.connect(packer).transferCustody(1, carrier.address);
    await expect(freshTrace.connect(carrier).updateStatus(1, Status.InTransit))
      .to.emit(freshTrace, "StatusUpdated")
      .withArgs(1, Status.InTransit);

    expect((await freshTrace.getBatch(1)).status).to.equal(Status.InTransit);
  });

  // Skipping a step is allowed, only going back is blocked
  it("allows skipping ahead", async function () {
    await freshTrace.connect(farmer).updateStatus(1, Status.InTransit);
    expect((await freshTrace.getBatch(1)).status).to.equal(Status.InTransit);
  });

  // Same status or an earlier one is rejected
  it("rejects the same or an earlier status", async function () {
    await freshTrace.connect(farmer).updateStatus(1, Status.Packed);
    await expect(freshTrace.connect(farmer).updateStatus(1, Status.Packed))
      .to.be.revertedWithCustomError(freshTrace, "StatusCannotGoBack");
    await expect(freshTrace.connect(farmer).updateStatus(1, Status.Harvested))
      .to.be.revertedWithCustomError(freshTrace, "StatusCannotGoBack");
  });

  // A wallet that does not hold the batch cannot change its status
  it("only the holder can update the status", async function () {
    await expect(freshTrace.connect(packer).updateStatus(1, Status.Packed))
      .to.be.revertedWithCustomError(freshTrace, "NotCurrentHolder");
  });

  // Reading a batch that does not exist fails
  it("rejects a missing batch", async function () {
    await expect(freshTrace.getBatch(99))
      .to.be.revertedWithCustomError(freshTrace, "BatchNotFound")
      .withArgs(99);
    await expect(freshTrace.getHistory(99))
      .to.be.revertedWithCustomError(freshTrace, "BatchNotFound")
      .withArgs(99);
  });

  // getBatch returns everything the farmer registered
  it("getBatch returns the batch details", async function () {
    const batch = await freshTrace.getBatch(1);
    expect(batch.id).to.equal(1);
    expect(batch.product).to.equal("Lettuce");
    expect(batch.quantityKg).to.equal(100);
    expect(batch.minLimit).to.equal(20);
    expect(batch.maxLimit).to.equal(80);
    expect(batch.farmer).to.equal(farmer.address);
    expect(batch.currentHolder).to.equal(farmer.address);
    expect(batch.certificateCID).to.equal(cid);
    expect(batch.status).to.equal(Status.Harvested);
    expect(batch.flagged).to.equal(false);
    expect(batch.recalled).to.equal(false);
  });

  // History has one entry for the register, the transfer and the status change, oldest first
  it("getHistory lists every step in order", async function () {
    await freshTrace.connect(farmer).transferCustody(1, packer.address);
    await freshTrace.connect(packer).updateStatus(1, Status.Packed);

    const history = await freshTrace.getHistory(1);
    expect(history.length).to.equal(3);

    expect(history[0].holder).to.equal(farmer.address);
    expect(history[0].status).to.equal(Status.Harvested);

    expect(history[1].holder).to.equal(packer.address);
    expect(history[1].status).to.equal(Status.Harvested);

    expect(history[2].holder).to.equal(packer.address);
    expect(history[2].status).to.equal(Status.Packed);
  });
});
