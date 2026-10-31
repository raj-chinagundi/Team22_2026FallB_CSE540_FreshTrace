// Role permission tests: admin role assignment and role checks on each
// role-restricted function.
const { expect } = require("chai");
const { ethers } = require("hardhat");

// same order as enum Role in IFreshTrace.sol
const Role = {
  None: 0,
  Farmer: 1,
  Packer: 2,
  Carrier: 3,
  DistributionCenter: 4,
  Retailer: 5,
  Regulator: 6,
  Sensor: 7,
};

describe("FreshTrace - role permissions", function () {
  let freshTrace, admin, farmer, regulator, sensor, outsider;

  beforeEach(async function () {
    [admin, farmer, regulator, sensor, outsider] = await ethers.getSigners();
    freshTrace = await ethers.deployContract("FreshTrace");
    await freshTrace.setRole(farmer.address, Role.Farmer);
    await freshTrace.setRole(regulator.address, Role.Regulator);
    await freshTrace.setRole(sensor.address, Role.Sensor);
  });

  describe("Admin", function () {
    it("makes the deployer the admin", async function () {
      expect(await freshTrace.admin()).to.equal(admin.address);
    });

    it("lets the admin assign a role and emits RoleAssigned", async function () {
      await expect(freshTrace.setRole(outsider.address, Role.Carrier))
        .to.emit(freshTrace, "RoleAssigned")
        .withArgs(outsider.address, Role.Carrier);
      expect(await freshTrace.roleOf(outsider.address)).to.equal(Role.Carrier);
    });

    it("lets the admin remove a role by setting Role.None", async function () {
      await freshTrace.setRole(farmer.address, Role.None);
      expect(await freshTrace.roleOf(farmer.address)).to.equal(Role.None);
    });

    it("blocks anyone else from assigning roles", async function () {
      await expect(
        freshTrace.connect(outsider).setRole(outsider.address, Role.Regulator)
      ).to.be.revertedWithCustomError(freshTrace, "NotAdmin");
    });
  });

  describe("Role checks", function () {
    it("only a Farmer can register a batch", async function () {
      await expect(
        freshTrace.connect(outsider).registerBatch("Lettuce", 100, 20, 80, "cid")
      )
        .to.be.revertedWithCustomError(freshTrace, "WrongRole")
        .withArgs(Role.Farmer, Role.None);
    });

    it("only a Sensor can record readings", async function () {
      await expect(
        freshTrace.connect(farmer).recordReadings(1, 30, 50, ethers.ZeroHash)
      )
        .to.be.revertedWithCustomError(freshTrace, "WrongRole")
        .withArgs(Role.Sensor, Role.Farmer);
    });

    it("only a Regulator can recall a batch", async function () {
      await expect(freshTrace.connect(farmer).recallBatch(1, "contamination"))
        .to.be.revertedWithCustomError(freshTrace, "WrongRole")
        .withArgs(Role.Regulator, Role.Farmer);
    });
  });

  describe("Batch checks", function () {
    it("rejects actions on a batch that does not exist", async function () {
      await expect(freshTrace.connect(regulator).recallBatch(99, "contamination"))
        .to.be.revertedWithCustomError(freshTrace, "BatchNotFound")
        .withArgs(99);
      await expect(
        freshTrace.connect(sensor).recordReadings(99, 30, 50, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(freshTrace, "BatchNotFound");
      await expect(
        freshTrace.connect(farmer).transferCustody(0, outsider.address)
      ).to.be.revertedWithCustomError(freshTrace, "BatchNotFound");
    });
  });
});
