# Frontend

TODO: React web UI

It will use React (Vite), ethers v6 and MetaMask, with its own `package.json` in this folder. The contract address and ABI come from `deployments/<network>.json`, which `scripts/deploy.js` writes. Users with a role connect MetaMask on Polygon Amoy (chain ID 80002). The customer page reads through a public RPC, so customers don't need a wallet.

Pages:

| Page | User | Contract calls |
|---|---|---|
| Admin | Admin | `setRole`, `roleOf` |
| Register batch | Farmer | IPFS upload, then `registerBatch` |
| My batches | Current holder | `transferCustody`, `updateStatus` |
| Recall | Regulator | `recallBatch` |
| Verify batch (`/batch/:id`, opened from the QR code) | Customer | `getBatch`, `getHistory`, `getReadings` |
