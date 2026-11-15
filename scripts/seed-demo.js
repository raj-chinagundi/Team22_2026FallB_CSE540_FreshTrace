// Rebuilds the demo state on the local chain, since it's wiped every time the node
// restarts. Walks one batch from the farm to the retailer with one sensor reading.
// Run with npm run seed:local, or npm run demo:local for deploy + roles + seed.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

// TODO: replace with the sample certificate CID from upload-certificate.js
const SAMPLE_CID = "bafkreisamplecertificatecidplaceholder";

// Same numbers as the Status enum in IFreshTrace.sol
const Status = { Harvested: 0, Packed: 1, InTransit: 2, AtDistributionCenter: 3, AtRetailer: 4 };

// Sends a transaction and waits for it to be mined
async function send(label, txPromise) {
  const tx = await txPromise;
  await tx.wait();
  console.log(`  ${label}`);
}

async function main() {
  if (network.name !== "localhost") {
    console.error("The seed script only runs on localhost (npm run seed:local).");
    process.exitCode = 1;
    return;
  }

  const file = path.join(__dirname, "..", "deployments", "localhost.json");
  if (!fs.existsSync(file)) {
    console.error("No deployments/localhost.json found. Run npm run deploy:local first.");
    process.exitCode = 1;
    return;
  }
  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));

  // Same accounts as setup-roles.js (#0 admin, #6 regulator aren't needed here)
  const [, farmer, packer, carrier, dc, retailer, , sensor] = await ethers.getSigners();
  const freshTrace = await ethers.getContractAt("FreshTrace", deployment.address);

  if (Number(await freshTrace.roleOf(farmer.address)) !== 1) {
    console.error("Roles aren't set up yet. Run npm run roles:local first.");
    process.exitCode = 1;
    return;
  }

  // Farmer registers the batch, safe range 0.0 to 5.0 °C (stored x10)
  console.log("Seeding the demo batch:");
  await send("Farmer registered Romaine lettuce", freshTrace.connect(farmer).registerBatch("Romaine lettuce", 500, 0, 50, SAMPLE_CID));
  const id = await freshTrace.batchCount();

  await send("Farmer -> Packer", freshTrace.connect(farmer).transferCustody(id, packer.address));
  await send("Packer: Packed", freshTrace.connect(packer).updateStatus(id, Status.Packed));
  await send("Packer -> Carrier", freshTrace.connect(packer).transferCustody(id, carrier.address));
  await send("Carrier: In transit", freshTrace.connect(carrier).updateStatus(id, Status.InTransit));

  // One in-range reading during transit. Save the log so its hash can be checked later.
  const log = {
    batchId: Number(id),
    sensor: sensor.address,
    unit: "°C x10",
    readings: [
      { time: new Date(Date.now() - 10 * 60 * 1000).toISOString(), value: 18 },
      { time: new Date(Date.now() - 5 * 60 * 1000).toISOString(), value: 34 },
      { time: new Date().toISOString(), value: 26 },
    ],
  };
  const text = JSON.stringify(log, null, 2);
  const logHash = ethers.keccak256(ethers.toUtf8Bytes(text));
  const logDir = path.join(__dirname, "..", "sensor-logs");
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(path.join(logDir, `localhost-batch${id}-seed.json`), text);
  await send("Sensor: 1.8 °C to 3.4 °C, within limits", freshTrace.connect(sensor).recordReadings(id, 18, 34, logHash));

  await send("Carrier -> Distribution center", freshTrace.connect(carrier).transferCustody(id, dc.address));
  await send("Distribution center: At distribution center", freshTrace.connect(dc).updateStatus(id, Status.AtDistributionCenter));
  await send("Distribution center -> Retailer", freshTrace.connect(dc).transferCustody(id, retailer.address));
  await send("Retailer: At retailer", freshTrace.connect(retailer).updateStatus(id, Status.AtRetailer));

  console.log("");
  console.log(`Batch #${id} "Romaine lettuce" is at the retailer. Open http://localhost:5173/batch/${id}`);
}

// Only the first line of the error, e.g. "Cannot connect to the network localhost"
main().catch((e) => {
  console.error(`Error: ${e.message.split("\n")[0]}`);
  process.exitCode = 1;
});
