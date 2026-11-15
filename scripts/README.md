# Scripts

Run these through the npm scripts in the root `package.json`.

- `deploy.js`: deploys FreshTrace and saves the address and ABI to `deployments/<network>.json` (`npm run deploy:local` or `deploy:amoy`)
- `setup-roles.js`: gives the demo wallets their roles (`npm run roles:local` or `roles:amoy`)
- `sensor-simulator.js`: generates 12 readings, saves the full log to `sensor-logs/`, and calls `recordReadings` from the sensor wallet with the min, the max and the log's keccak256 hash (`npm run sensor:local -- <batchId>`, add `--bad` for one reading that's too warm)
- `seed-demo.js`: walks one batch from the farmer to the retailer, with one sensor reading on the way, so a fresh local chain has a full journey to show (`npm run seed:local`, or `npm run demo:local` for deploy + roles + seed)
- `upload-certificate.js`: uploads a certificate to IPFS through Pinata and prints the CID to use in `registerBatch` (`npm run upload-cert -- <file>`)
