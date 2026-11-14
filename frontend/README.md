# Frontend

React web UI for FreshTrace (Vite, React, ethers v6, MetaMask). Users with a role connect MetaMask and send transactions. The customer page reads the contract through a public RPC, so customers don't need a wallet.

The contract address and ABI come from `../deployments/<network>.json`, which `scripts/deploy.js` writes. `scripts/setup-roles.js` adds the team wallets to the same file, so the UI can show "Packer" instead of a raw address.

## Running it locally

Needs Node 20.19+ or 22.12+.

```bash
# terminal 1 (repo root)
npx hardhat node

# terminal 2 (repo root)
npm run deploy:local
npm run roles:local

# terminal 3
cd frontend
npm install
cp .env.example .env    # VITE_NETWORK=localhost
npm run dev             # http://localhost:5173
```

In MetaMask, add the network RPC `http://127.0.0.1:8545`, chain ID `31337`, and import the test accounts that `npx hardhat node` prints. Account #0 is the admin and accounts #1 to #7 are Farmer, Packer, Carrier, DistributionCenter, Retailer, Regulator and Sensor.

If you restart `npx hardhat node`, deploy and set up the roles again, and clear the activity tab data in MetaMask (Settings → Advanced) so the nonces reset.

## Running it on Polygon Amoy

Set `VITE_NETWORK=amoy` in `frontend/.env` and run `npm run dev`. The contract has to be deployed on Amoy first (`deployments/amoy.json`). If the public RPC is slow, put your own Amoy RPC URL in `VITE_AMOY_RPC_URL`.

## Pages

| Page | User | Contract calls |
|---|---|---|
| Home (`/`) | Anyone | `batchCount`, `getBatch` |
| Admin (`/admin`) | Admin | `setRole`, `roleOf` |
| Register batch (`/register`) | Farmer | `registerBatch` (certificate CID from `npm run upload-cert`) |
| My batches (`/my-batches`) | Current holder | `transferCustody`, `updateStatus` |
| Recall (`/recall`) | Regulator | `recallBatch` |
| Verify batch (`/batch/:id`, opened from the QR code) | Customer | `getBatch`, `getHistory`, `getReadings` |

## Code

- `src/contract.js`: network settings, the read-only contract, role and status names, formatting helpers and `errorText` for contract errors
- `src/wallet.jsx`: MetaMask connection, the connected account's role, and a contract object that can send transactions (`useWallet()`)
- `src/tx.jsx`: `useTx()` sends a transaction and `<TxStatus />` shows its progress or the error
- `src/pages/`: one file per page
