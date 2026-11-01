// Deploys FreshTrace and saves the address and ABI to deployments/<network>.json
// so setup-roles.js and the frontend can find the contract.
// Run with npm run deploy:local or npm run deploy:amoy.
const fs = require("fs");
const path = require("path");
const { ethers, network, artifacts } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();   // first account = admin
  if (!deployer) {
    throw new Error(`No account for "${network.name}". Put a key in DEPLOYER_PRIVATE_KEY in .env.`);
  }

  console.log(`Deploying FreshTrace to ${network.name} from ${deployer.address}`);

  const freshTrace = await ethers.deployContract("FreshTrace");
  await freshTrace.waitForDeployment();

  const address = await freshTrace.getAddress();
  const { chainId } = await ethers.provider.getNetwork();

  // chainId comes back as a BigInt and JSON.stringify can't serialize those
  const deployment = {
    network: network.name,
    chainId: Number(chainId),
    address,
    deployer: deployer.address,
    abi: artifacts.readArtifactSync("FreshTrace").abi,
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(deployment, null, 2) + "\n");

  console.log(`FreshTrace: ${address}`);
  console.log(`Admin:      ${deployer.address}`);
  console.log(`Saved to    deployments/${network.name}.json`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
