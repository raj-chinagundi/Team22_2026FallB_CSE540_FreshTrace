// Tests for sensor readings, flagging and recalls.
const { expect } = require("chai");
const { ethers } = require("hardhat");

// same order as the enums in IFreshTrace.sol
const Role = { None: 0, Farmer: 1, Packer: 2, Carrier: 3, DistributionCenter: 4, Retailer: 5, Regulator: 6, Sensor: 7 };
const Status = { Harvested: 0, Packed: 1, InTransit: 2, AtDistributionCenter: 3, AtRetailer: 4 };

describe("FreshTrace - sensor readings and recalls", function () {
  let freshTrace, admin, farmer, packer, regulator, sensor;
  const cid = "bafyTestCID";
  const logHash = ethers.id("log1");

  beforeEach(async function () {
    [admin, farmer, packer, regulator, sensor] = await ethers.getSigners();
    freshTrace = await ethers.deployContract("FreshTrace");

    // give each test wallet its role (admin is account 0, the deployer)
    await freshTrace.setRole(farmer.address, Role.Farmer);
    await freshTrace.setRole(packer.address, Role.Packer);
    await freshTrace.setRole(regulator.address, Role.Regulator);
    await freshTrace.setRole(sensor.address, Role.Sensor);

    // one batch for every test: lettuce, 100 kg, safe range 2.0 to 8.0 C
    await freshTrace.connect(farmer).registerBatch("Lettuce", 100, 20, 80, cid);
  });

  describe("readings", function () {
    // A reading inside the safe range is saved and does not flag the batch
    it("accepts an in-range reading", async function () {
      await expect(freshTrace.connect(sensor).recordReadings(1, 30, 50, logHash))
        .to.emit(freshTrace, "ReadingsRecorded")
        .withArgs(1, 30, 50, logHash);
      expect((await freshTrace.getBatch(1)).flagged).to.equal(false);
    });

    // The limits themselves are still safe
    it("does not flag a reading exactly on the limits", async function () {
      await expect(freshTrace.connect(sensor).recordReadings(1, 20, 80, logHash))
        .to.not.emit(freshTrace, "BatchFlagged");
      expect((await freshTrace.getBatch(1)).flagged).to.equal(false);
    });

    // Too cold flags the batch
    it("flags a reading below the range", async function () {
      await expect(freshTrace.connect(sensor).recordReadings(1, 10, 50, logHash))
        .to.emit(freshTrace, "BatchFlagged")
        .withArgs(1, 10, 50);
      expect((await freshTrace.getBatch(1)).flagged).to.equal(true);
    });

    // Too warm flags the batch
    it("flags a reading above the range", async function () {
      await expect(freshTrace.connect(sensor).recordReadings(1, 30, 90, logHash))
        .to.emit(freshTrace, "BatchFlagged")
        .withArgs(1, 30, 90);
      expect((await freshTrace.getBatch(1)).flagged).to.equal(true);
    });

    // getReadings keeps every summary in order, with withinLimits set correctly
    it("getReadings returns every summary in order", async function () {
      await freshTrace.connect(sensor).recordReadings(1, 30, 50, logHash);
      await freshTrace.connect(sensor).recordReadings(1, 10, 50, logHash);

      const list = await freshTrace.getReadings(1);
      expect(list.length).to.equal(2);
      expect(list[0].minValue).to.equal(30);
      expect(list[0].maxValue).to.equal(50);
      expect(list[0].logHash).to.equal(logHash);
      expect(list[0].withinLimits).to.equal(true);
      expect(list[1].minValue).to.equal(10);
      expect(list[1].withinLimits).to.equal(false);
    });

    // A minimum above the maximum makes no sense
    it("rejects a min above the max", async function () {
      await expect(freshTrace.connect(sensor).recordReadings(1, 50, 30, logHash))
        .to.be.revertedWithCustomError(freshTrace, "InvalidReadings");
    });
  });

  describe("flagged batch", function () {
    beforeEach(async function () {
      // out-of-range reading flags the batch
      await freshTrace.connect(sensor).recordReadings(1, 10, 50, logHash);
    });

    // A flagged batch is frozen
    it("cannot be transferred or change status", async function () {
      await expect(freshTrace.connect(farmer).transferCustody(1, packer.address))
        .to.be.revertedWithCustomError(freshTrace, "BatchIsFlagged")
        .withArgs(1);
      await expect(freshTrace.connect(farmer).updateStatus(1, Status.Packed))
        .to.be.revertedWithCustomError(freshTrace, "BatchIsFlagged")
        .withArgs(1);
    });

    // The flag is permanent, a good reading later does not clear it
    it("stays flagged after an in-range reading", async function () {
      await freshTrace.connect(sensor).recordReadings(1, 30, 50, logHash);
      expect((await freshTrace.getBatch(1)).flagged).to.equal(true);
    });
  });

  describe("recall", function () {
    // Regulator recalls the batch and the event shows who and why
    it("regulator can recall a batch", async function () {
      await expect(freshTrace.connect(regulator).recallBatch(1, "contamination"))
        .to.emit(freshTrace, "BatchRecalled")
        .withArgs(1, regulator.address, "contamination");
      expect((await freshTrace.getBatch(1)).recalled).to.equal(true);
    });

    // A recalled batch is frozen, even for a second recall
    it("blocks everything after a recall", async function () {
      await freshTrace.connect(regulator).recallBatch(1, "contamination");

      await expect(freshTrace.connect(farmer).transferCustody(1, packer.address))
        .to.be.revertedWithCustomError(freshTrace, "BatchIsRecalled")
        .withArgs(1);
      await expect(freshTrace.connect(farmer).updateStatus(1, Status.Packed))
        .to.be.revertedWithCustomError(freshTrace, "BatchIsRecalled")
        .withArgs(1);
      await expect(freshTrace.connect(sensor).recordReadings(1, 30, 50, logHash))
        .to.be.revertedWithCustomError(freshTrace, "BatchIsRecalled")
        .withArgs(1);
      await expect(freshTrace.connect(regulator).recallBatch(1, "again"))
        .to.be.revertedWithCustomError(freshTrace, "BatchIsRecalled")
        .withArgs(1);
    });

    // The record stays readable after a recall
    it("can still be read after a recall", async function () {
      await freshTrace.connect(sensor).recordReadings(1, 30, 50, logHash);
      await freshTrace.connect(regulator).recallBatch(1, "contamination");

      expect((await freshTrace.getBatch(1)).recalled).to.equal(true);
      expect((await freshTrace.getHistory(1)).length).to.equal(1);
      expect((await freshTrace.getReadings(1)).length).to.equal(1);
    });
  });
});
