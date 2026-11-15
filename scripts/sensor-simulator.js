// Pretends to be the temperature sensor on a batch. Makes 12 readings, saves the
// full log to sensor-logs/, and sends only the min, the max and the log's keccak256
// hash to recordReadings. Plain Node (not hardhat run) so it can take arguments.
// Usage: npm run sensor:local -- <batchId> [--bad]   (--bad = one reading too warm)
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config({ quiet: true });

const SENSOR_ROLE = 7;               // Role.Sensor in IFreshTrace.sol
const READINGS = 12;                 // one every 5 minutes, so the last hour
const STEP_MS = 5 * 60 * 1000;

// Hardhat's public test phrase. Account #7 gets the Sensor role from roles:local.
const HARDHAT_PHRASE = "test test test test test test test test test test test junk";

// Stops the script with a short message instead of a stack trace
function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

// Readings and limits are stored x10, so 45 -> "4.5 °C"
function celsius(x10) {
  return `${(x10 / 10).toFixed(1)} °C`;
}

// Turns a revert into its error name, like "BatchIsRecalled(2)"
function revertName(e, contract) {
  if (e.revert?.name) return `${e.revert.name}(${Array.from(e.revert.args).join(", ")})`;
  try {
    const parsed = contract.interface.parseError(e.data);
    if (parsed) return `${parsed.name}(${Array.from(parsed.args).join(", ")})`;
  } catch {
    // not one of our errors
  }
  return e.shortMessage || e.message;
}

async function main() {
  const network = process.argv[2];
  const batchId = Number(process.argv[3]);
  const bad = process.argv.includes("--bad");

  if (network !== "localhost" && network !== "amoy") fail("network has to be localhost or amoy");
  const npmName = network === "localhost" ? "local" : "amoy";   // npm scripts are sensor:local, deploy:local, ...
  if (!Number.isInteger(batchId) || batchId < 1) {
    fail(`give a batch ID, like: npm run sensor:${npmName} -- 1`);
  }

  // address + ABI saved by deploy.js
  const file = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (!fs.existsSync(file)) fail(`no deployments/${network}.json found. Run npm run deploy:${npmName} first.`);
  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));

  // staticNetwork stops ethers from retrying forever when the node isn't running
  const rpcUrl = network === "localhost"
    ? "http://127.0.0.1:8545"
    : process.env.AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com";
  const provider = new ethers.JsonRpcProvider(rpcUrl, deployment.chainId, { staticNetwork: true });

  // Sensor wallet: Hardhat account #7 locally, our own key from .env on Amoy
  let sensor;
  if (network === "localhost") {
    sensor = ethers.HDNodeWallet.fromPhrase(HARDHAT_PHRASE, undefined, "m/44'/60'/0'/0/7").connect(provider);
  } else {
    if (!process.env.SENSOR_PRIVATE_KEY) fail("SENSOR_PRIVATE_KEY is empty in .env");
    sensor = new ethers.Wallet(process.env.SENSOR_PRIVATE_KEY, provider);
  }

  const contract = new ethers.Contract(deployment.address, deployment.abi, sensor);

  // roleOf returns a BigInt, so compare it as a number
  let role;
  try {
    role = Number(await contract.roleOf(sensor.address));
  } catch (e) {
    fail(`can't reach ${rpcUrl}. Is the node running? (npx hardhat node)`);
  }
  if (role !== SENSOR_ROLE) fail(`This wallet doesn't have the Sensor role (${sensor.address}). Run npm run roles:${npmName}.`);

  let batch;
  try {
    batch = await contract.getBatch(batchId);
  } catch (e) {
    fail(revertName(e, contract));
  }
  const minLimit = Number(batch.minLimit);
  const maxLimit = Number(batch.maxLimit);

  // Random values in the middle 60% of the safe range, one every 5 minutes ending now
  const lo = minLimit + Math.ceil((maxLimit - minLimit) * 0.2);
  const hi = maxLimit - Math.ceil((maxLimit - minLimit) * 0.2);
  const now = Date.now();
  const readings = [];
  for (let i = 0; i < READINGS; i++) {
    const value = lo + Math.floor(Math.random() * (hi - lo + 1));
    readings.push({ time: new Date(now - (READINGS - 1 - i) * STEP_MS).toISOString(), value });
  }
  // --bad: cooling failure, one reading 3 °C above the max
  if (bad) readings[8].value = maxLimit + 30;

  const values = readings.map((r) => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // The hash is over this exact text, so the saved file can be checked against the chain later
  const log = { batchId, sensor: sensor.address, unit: "°C x10", readings };
  const text = JSON.stringify(log, null, 2);
  const logHash = ethers.keccak256(ethers.toUtf8Bytes(text));

  const logDir = path.join(__dirname, "..", "sensor-logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `${network}-batch${batchId}-${now}.json`);
  fs.writeFileSync(logFile, text);

  let tx;
  try {
    tx = await contract.recordReadings(batchId, min, max, logHash);
    await tx.wait();
  } catch (e) {
    fail(`recordReadings reverted: ${revertName(e, contract)}`);
  }

  const flagged = (await contract.getBatch(batchId)).flagged;

  console.log(`Sensor ${sensor.address} on ${network}, batch #${batchId} "${batch.product}"`);
  console.log(`Readings:   ${values.map(celsius).join(", ")}`);
  console.log(`Min / max:  ${celsius(min)} / ${celsius(max)}`);
  console.log(`Safe range: ${celsius(minLimit)} to ${celsius(maxLimit)}`);
  console.log(`Log hash:   ${logHash}`);
  console.log(`Log file:   ${path.relative(process.cwd(), logFile)}`);
  console.log(`Tx:         ${tx.hash}`);
  console.log("");
  if (min >= minLimit && max <= maxLimit) {
    console.log("Within limits");
  } else {
    console.log(`OUT OF RANGE -> batch #${batchId} is now ${flagged ? "FLAGGED" : "not flagged (check the contract)"}`);
  }
}

main().catch((e) => fail(e.shortMessage || e.message));
