// Gives each demo wallet its role on an already deployed FreshTrace.
// Reads the contract address from deployments/<network>.json, so deploy first.
// Run with npm run roles:local or npm run roles:amoy.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

// same order as the Role enum in IFreshTrace.sol
const Role = { None: 0, Farmer: 1, Packer: 2, Carrier: 3, DistributionCenter: 4, Retailer: 5, Regulator: 6, Sensor: 7 };

// On localhost these go to accounts 1 to 7 in this order (account 0 is the admin)
const ROLES = [
  ["Farmer", Role.Farmer],
  ["Packer", Role.Packer],
  ["Carrier", Role.Carrier],
  ["DistributionCenter", Role.DistributionCenter],
  ["Retailer", Role.Retailer],
  ["Regulator", Role.Regulator],
  ["Sensor", Role.Sensor],
];

// Team MetaMask wallets for Amoy. Fill these in before running roles:amoy.
// Anything left as the zero address is skipped.
const AMOY_WALLETS = {
  Farmer: ethers.ZeroAddress,
  Packer: ethers.ZeroAddress,
  Carrier: ethers.ZeroAddress,
  DistributionCenter: ethers.ZeroAddress,
  Retailer: ethers.ZeroAddress,
  Regulator: ethers.ZeroAddress,
  Sensor: ethers.ZeroAddress,
};

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) {
    console.error(`No deployments/${network.name}.json found. Run the deploy script first.`);
    process.exitCode = 1;
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));
  const signers = await ethers.getSigners();
  const admin = signers[0];   // setRole only works from the deployer

  if (admin.address !== deployment.deployer) {
    console.warn(`Warning: ${deployment.address} was deployed by ${deployment.deployer}, setRole will revert.`);
  }

  const freshTrace = await ethers.getContractAt("FreshTrace", deployment.address, admin);

  // test accounts on a local chain, the team's own wallets on Amoy
  const targets = ROLES.map(([name, role], i) => ({
    name,
    role,
    account: network.name === "localhost" ? signers[i + 1]?.address : AMOY_WALLETS[name],
  }));

  const assigned = [];
  for (const target of targets) {
    if (!target.account || target.account === ethers.ZeroAddress) {
      console.log(`Skipping ${target.name}, no wallet set yet`);
      continue;
    }
    const tx = await freshTrace.setRole(target.account, target.role);
    await tx.wait();
    assigned.push({ role: target.name, account: target.account });
  }

  console.log(`FreshTrace at ${deployment.address} on ${network.name}`);
  console.log(`Admin:      ${admin.address}`);
  console.table(assigned);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
