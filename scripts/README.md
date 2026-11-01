# Scripts

Run these through the npm scripts in the root `package.json`.

- `deploy.js`: deploys FreshTrace and saves the address and ABI to `deployments/<network>.json` (`npm run deploy:local` or `deploy:amoy`)
- `setup-roles.js`: gives the demo wallets their roles (`npm run roles:local` or `roles:amoy`)
- `sensor-simulator.js` (TODO): generates a set of readings, saves the full log, and calls `recordReadings` from the sensor wallet with the min, the max and the log's keccak256 hash (`npm run sensor:local`)
- `upload-certificate.js` (TODO): uploads a certificate to IPFS through Pinata and prints the CID to use in `registerBatch` (`npm run upload-cert -- <file>`)
