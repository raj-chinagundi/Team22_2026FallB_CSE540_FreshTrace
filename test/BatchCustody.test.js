// Tests for registerBatch and transferCustody.
const { expect } = require("chai");
const { ethers } = require("hardhat");

// same order as the enums in IFreshTrace.sol
const Role = { None: 0, Farmer: 1, Packer: 2, Carrier: 3, DistributionCenter: 4, Retailer: 5, Regulator: 6, Sensor: 7 };

describe("FreshTrace - batches and custody", function () {
  let freshTrace, admin, farmer, packer, carrier, regulator, outsider;
  const cid = "bafyTestCID";

  // no batch here, each test registers its own
  beforeEach(async function () {
    [admin, farmer, packer, carrier, regulator, outsider] = await ethers.getSigners();
    freshTrace = await ethers.deployContract("FreshTrace");
    await freshTrace.setRole(farmer.address, Role.Farmer);
    await freshTrace.setRole(packer.address, Role.Packer);
    await freshTrace.setRole(carrier.address, Role.Carrier);
    await freshTrace.setRole(regulator.address, Role.Regulator);
  });

  // First batch gets ID 1 and emits BatchRegistered
  it("farmer registers a batch", async function () {
    await expect(freshTrace.connect(farmer).registerBatch("Lettuce", 100, 20, 80, cid))
      .to.emit(freshTrace, "BatchRegistered")
      .withArgs(1, farmer.address, "Lettuce", cid);
    expect(await freshTrace.batchCount()).to.equal(1);
  });

  // minLimit has to be below maxLimit
  it("rejects bad limits", async function () {
    await expect(freshTrace.connect(farmer).registerBatch("Lettuce", 100, 80, 80, cid))
      .to.be.revertedWithCustomError(freshTrace, "InvalidLimits");
  });

  // Each handoff emits CustodyTransferred with the old and new holder
  it("moves farmer to packer to carrier", async function () {
    await freshTrace.connect(farmer).registerBatch("Lettuce", 100, 20, 80, cid);
    await expect(freshTrace.connect(farmer).transferCustody(1, packer.address))
      .to.emit(freshTrace, "CustodyTransferred")
      .withArgs(1, farmer.address, packer.address);
    await expect(freshTrace.connect(packer).transferCustody(1, carrier.address))
      .to.emit(freshTrace, "CustodyTransferred")
      .withArgs(1, packer.address, carrier.address);
  });

  // The farmer can't move the batch again after handing it off
  it("only the holder can transfer", async function () {
    await freshTrace.connect(farmer).registerBatch("Lettuce", 100, 20, 80, cid);
    await freshTrace.connect(farmer).transferCustody(1, packer.address);
    await expect(freshTrace.connect(farmer).transferCustody(1, carrier.address))
      .to.be.revertedWithCustomError(freshTrace, "NotCurrentHolder");
  });

  // Can't send to yourself, to a wallet with no role, or to a role that can't hold a batch
  it("rejects bad recipients", async function () {
    await freshTrace.connect(farmer).registerBatch("Lettuce", 100, 20, 80, cid);
    for (const to of [farmer, outsider, regulator]) {
      await expect(freshTrace.connect(farmer).transferCustody(1, to.address))
        .to.be.revertedWithCustomError(freshTrace, "InvalidRecipient");
    }
  });

  // Transferring a batch that was never registered fails
  it("rejects a missing batch", async function () {
    await expect(freshTrace.connect(farmer).transferCustody(99, packer.address))
      .to.be.revertedWithCustomError(freshTrace, "BatchNotFound")
      .withArgs(99);
  });
});
