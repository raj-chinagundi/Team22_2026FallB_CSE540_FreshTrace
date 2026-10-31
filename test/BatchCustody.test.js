const { expect } = require("chai");
const { ethers } = require("hardhat");

const Role = { None: 0, Farmer: 1, Packer: 2, Carrier: 3, DistributionCenter: 4, Retailer: 5, Regulator: 6, Sensor: 7 };

describe("FreshTrace - batches and custody", function () {
  let freshTrace, admin, farmer, packer, carrier, regulator, outsider;
  const cid = "bafyTestCID";

  beforeEach(async function () {
    [admin, farmer, packer, carrier, regulator, outsider] = await ethers.getSigners();
    freshTrace = await ethers.deployContract("FreshTrace");
    await freshTrace.setRole(farmer.address, Role.Farmer);
    await freshTrace.setRole(packer.address, Role.Packer);
    await freshTrace.setRole(carrier.address, Role.Carrier);
    await freshTrace.setRole(regulator.address, Role.Regulator);
  });

  it("farmer registers a batch", async function () {
    await expect(freshTrace.connect(farmer).registerBatch("Lettuce", 100, 20, 80, cid))
      .to.emit(freshTrace, "BatchRegistered")
      .withArgs(1, farmer.address, "Lettuce", cid);
    expect(await freshTrace.batchCount()).to.equal(1);
  });

  it("rejects bad limits", async function () {
    await expect(freshTrace.connect(farmer).registerBatch("Lettuce", 100, 80, 80, cid))
      .to.be.revertedWithCustomError(freshTrace, "InvalidLimits");
  });

  it("moves farmer to packer to carrier", async function () {
    await freshTrace.connect(farmer).registerBatch("Lettuce", 100, 20, 80, cid);
    await expect(freshTrace.connect(farmer).transferCustody(1, packer.address))
      .to.emit(freshTrace, "CustodyTransferred")
      .withArgs(1, farmer.address, packer.address);
    await expect(freshTrace.connect(packer).transferCustody(1, carrier.address))
      .to.emit(freshTrace, "CustodyTransferred")
      .withArgs(1, packer.address, carrier.address);
  });

  it("only the holder can transfer", async function () {
    await freshTrace.connect(farmer).registerBatch("Lettuce", 100, 20, 80, cid);
    await freshTrace.connect(farmer).transferCustody(1, packer.address);
    await expect(freshTrace.connect(farmer).transferCustody(1, carrier.address))
      .to.be.revertedWithCustomError(freshTrace, "NotCurrentHolder");
  });

  it("rejects bad recipients", async function () {
    await freshTrace.connect(farmer).registerBatch("Lettuce", 100, 20, 80, cid);
    for (const to of [farmer, outsider, regulator]) {
      await expect(freshTrace.connect(farmer).transferCustody(1, to.address))
        .to.be.revertedWithCustomError(freshTrace, "InvalidRecipient");
    }
  });

  it("rejects a missing batch", async function () {
    await expect(freshTrace.connect(farmer).transferCustody(99, packer.address))
      .to.be.revertedWithCustomError(freshTrace, "BatchNotFound")
      .withArgs(99);
  });
});
