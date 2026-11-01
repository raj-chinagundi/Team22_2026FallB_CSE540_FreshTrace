// End-to-end test: one batch goes from the farm to the retailer with every role taking part.
const { expect } = require("chai");
const { ethers } = require("hardhat");

// same order as the enums in IFreshTrace.sol
const Role = { None: 0, Farmer: 1, Packer: 2, Carrier: 3, DistributionCenter: 4, Retailer: 5, Regulator: 6, Sensor: 7 };
const Status = { Harvested: 0, Packed: 1, InTransit: 2, AtDistributionCenter: 3, AtRetailer: 4 };

describe("FreshTrace - end to end", function () {
  let freshTrace, admin, farmer, packer, carrier, dc, retailer, regulator, sensor;

  beforeEach(async function () {
    [admin, farmer, packer, carrier, dc, retailer, regulator, sensor] = await ethers.getSigners();
    freshTrace = await ethers.deployContract("FreshTrace");
  });

  // Full happy path: roles, register, in-range reading, four handoffs with status updates
  it("tracks a batch from farmer to retailer", async function () {
    // admin gives all 7 roles
    const roles = [
      [farmer, Role.Farmer],
      [packer, Role.Packer],
      [carrier, Role.Carrier],
      [dc, Role.DistributionCenter],
      [retailer, Role.Retailer],
      [regulator, Role.Regulator],
      [sensor, Role.Sensor],
    ];
    for (const [wallet, role] of roles) {
      await expect(freshTrace.setRole(wallet.address, role))
        .to.emit(freshTrace, "RoleAssigned")
        .withArgs(wallet.address, role);
    }

    // farmer registers lettuce, 100 kg, safe range 2.0 to 8.0 C
    await expect(freshTrace.connect(farmer).registerBatch("Lettuce", 100, 20, 80, "bafyTestCID"))
      .to.emit(freshTrace, "BatchRegistered")
      .withArgs(1, farmer.address, "Lettuce", "bafyTestCID");

    // sensor posts an in-range summary (3.0 to 5.0 C), so the batch is not flagged
    await expect(freshTrace.connect(sensor).recordReadings(1, 30, 50, ethers.id("log1")))
      .to.emit(freshTrace, "ReadingsRecorded")
      .withArgs(1, 30, 50, ethers.id("log1"))
      .and.not.to.emit(freshTrace, "BatchFlagged");

    // each holder hands the batch on, then the new holder moves the status forward
    const legs = [
      [farmer, packer, Status.Packed],
      [packer, carrier, Status.InTransit],
      [carrier, dc, Status.AtDistributionCenter],
      [dc, retailer, Status.AtRetailer],
    ];
    for (const [from, to, status] of legs) {
      await expect(freshTrace.connect(from).transferCustody(1, to.address))
        .to.emit(freshTrace, "CustodyTransferred")
        .withArgs(1, from.address, to.address);
      await expect(freshTrace.connect(to).updateStatus(1, status))
        .to.emit(freshTrace, "StatusUpdated")
        .withArgs(1, status);
    }

    // final state: retailer holds it, status AtRetailer, not flagged or recalled
    const batch = await freshTrace.getBatch(1);
    expect(batch.currentHolder).to.equal(retailer.address);
    expect(batch.status).to.equal(Status.AtRetailer);
    expect(batch.flagged).to.equal(false);
    expect(batch.recalled).to.equal(false);

    // 1 register + 4 transfers + 4 status updates, oldest first
    const history = await freshTrace.getHistory(1);
    expect(history.length).to.equal(9);
    expect(history[0].holder).to.equal(farmer.address);
    expect(history[0].status).to.equal(Status.Harvested);
    expect(history[8].holder).to.equal(retailer.address);
    expect(history[8].status).to.equal(Status.AtRetailer);

    // the one sensor summary is stored and marked in range
    const readings = await freshTrace.getReadings(1);
    expect(readings.length).to.equal(1);
    expect(readings[0].withinLimits).to.equal(true);
  });
});
