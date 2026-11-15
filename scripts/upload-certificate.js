require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");

async function main() {
  if (!process.env.PINATA_JWT) {
    console.log("Put your Pinata JWT in PINATA_JWT in .env");
    process.exitCode = 1;
    return;
  }
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.log("Usage: npm run upload-cert -- <file>");
    console.log("Example: npm run upload-cert -- docs/sample-certificate.pdf");
    process.exitCode = 1;
    return;
  }

  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(file)]), path.basename(file));
  form.append("pinataMetadata", JSON.stringify({ name: path.basename(file) }));

  console.log(`Uploading ${file} to IPFS through Pinata...`);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    body: form,
  });
  if (!res.ok) {
    console.log(`Upload failed: ${res.status} ${res.statusText}`);
    console.log(await res.text());
    process.exitCode = 1;
    return;
  }

  const cid = (await res.json()).IpfsHash;
  console.log("");
  console.log(`CID: ${cid}`);
  console.log(`Link: https://ipfs.io/ipfs/${cid}`);
  console.log(`Pinata link: https://gateway.pinata.cloud/ipfs/${cid}`);
  console.log("");
  console.log("Paste the CID into the Register batch page. Only the CID goes on-chain.");
}

main().catch((e) => {
  console.log(`Upload failed: ${e.message}`);
  process.exitCode = 1;
});
