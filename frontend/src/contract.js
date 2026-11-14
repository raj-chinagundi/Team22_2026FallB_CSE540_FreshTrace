// Shared setup for every page: which network we're on, the contract objects,
// the enum names and some small formatting helpers.
import { ethers } from "ethers";

// localhost = npx hardhat node, amoy = Polygon testnet. Set in frontend/.env
export const NETWORK = import.meta.env.VITE_NETWORK || "localhost";

const NETWORKS = {
  localhost: {
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    explorer: null,
    label: "Hardhat local",
  },
  amoy: {
    chainId: 80002,
    rpcUrl: import.meta.env.VITE_AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com",
    explorer: "https://amoy.polygonscan.com",
    label: "Polygon Amoy",
  },
};

export const NET = NETWORKS[NETWORK];

// deploy.js writes deployments/<network>.json (address + ABI). The glob doesn't fail
// when a file is missing, it just isn't in the list.
const files = import.meta.glob("../../deployments/*.json", { eager: true, import: "default" });
export const deployment = files[`../../deployments/${NETWORK}.json`] ?? null;

// Read-only contract through a normal RPC, no wallet needed. Use it for all reads.
export const readContract = deployment && NET
  ? new ethers.Contract(deployment.address, deployment.abi, new ethers.JsonRpcProvider(NET.rpcUrl, NET.chainId, { staticNetwork: true }))
  : null;

// Same order as the enums in IFreshTrace.sol
export const Role = { None: 0, Farmer: 1, Packer: 2, Carrier: 3, DistributionCenter: 4, Retailer: 5, Regulator: 6, Sensor: 7 };
export const Status = { Harvested: 0, Packed: 1, InTransit: 2, AtDistributionCenter: 3, AtRetailer: 4 };

export const ROLE_NAMES = ["None", "Farmer", "Packer", "Carrier", "Distribution center", "Retailer", "Regulator", "Sensor"];
export const STATUS_NAMES = ["Harvested", "Packed", "In transit", "At distribution center", "At retailer"];

// Only these roles can receive a batch (same as _canHoldBatch in the contract)
export const HOLDER_ROLES = [Role.Packer, Role.Carrier, Role.DistributionCenter, Role.Retailer];

// Role name -> address, saved by setup-roles.js. Empty if roles weren't set up yet.
export const wallets = deployment?.wallets ?? {};

// 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC -> 0x3C44…93BC
export function shortAddr(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// Shows "Packer (0x3C44…93BC)" for our known wallets, otherwise just the short address
export function labelFor(address) {
  if (!address) return "";
  const name = Object.keys(wallets).find((n) => wallets[n].toLowerCase() === address.toLowerCase());
  return name ? `${name} (${shortAddr(address)})` : shortAddr(address);
}

// Readings and limits are stored x10 on-chain, so 45 -> "4.5 °C"
export function toCelsius(x10) {
  return `${(Number(x10) / 10).toFixed(1)} °C`;
}

// "4.5" -> 45
export function fromCelsius(text) {
  return Math.round(Number(text) * 10);
}

// Block timestamps are in seconds
export function formatTime(ts) {
  return new Date(Number(ts) * 1000).toLocaleString();
}

// Explorer links, null on localhost since there's no explorer
export function txLink(hash) {
  return NET?.explorer ? `${NET.explorer}/tx/${hash}` : null;
}

export function addressLink(address) {
  return NET?.explorer ? `${NET.explorer}/address/${address}` : null;
}

export function ipfsLink(cid) {
  return `https://ipfs.io/ipfs/${cid}`;
}

// getBatch returns a Result with BigInts, this turns it into a plain object
export function toBatch(b) {
  return {
    id: Number(b.id),
    product: b.product,
    quantityKg: Number(b.quantityKg),
    farmer: b.farmer,
    currentHolder: b.currentHolder,
    status: Number(b.status),
    minLimit: Number(b.minLimit),
    maxLimit: Number(b.maxLimit),
    flagged: b.flagged,
    recalled: b.recalled,
    certificateCID: b.certificateCID,
    createdAt: Number(b.createdAt),
  };
}

// Reads every batch (IDs go from 1 to batchCount). Fine for a handful of batches.
export async function loadAllBatches() {
  const count = Number(await readContract.batchCount());
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const results = await Promise.all(ids.map((id) => readContract.getBatch(id)));
  return results.map(toBatch);
}

// Short explanation for each custom error in IFreshTrace.sol
const ERROR_HELP = {
  NotAdmin: "only the admin can assign roles",
  WrongRole: "your wallet doesn't have the right role",
  NotCurrentHolder: "only the current holder can do this",
  BatchNotFound: "there is no batch with that ID",
  BatchIsFlagged: "batch is flagged, it can't move",
  BatchIsRecalled: "batch was recalled",
  InvalidLimits: "min limit has to be lower than max limit",
  InvalidReadings: "min reading is higher than max reading",
  InvalidRecipient: "that wallet can't receive a batch",
  StatusCannotGoBack: "status can only move forward",
};

// WrongRole args are role numbers, so show their names instead
function formatError(name, args) {
  const shown = name === "WrongRole"
    ? Array.from(args).map((a) => ROLE_NAMES[Number(a)])
    : Array.from(args).map((a) => a.toString());
  const help = ERROR_HELP[name];
  return `${name}(${shown.join(", ")})${help ? `: ${help}` : ""}`;
}

// Turns any failed call into a readable message. Contract errors show their name,
// like "BatchIsFlagged(2): batch is flagged, it can't move".
export function errorText(e) {
  if (e?.code === "ACTION_REJECTED") return "Rejected in MetaMask";
  if (e?.revert?.name) return formatError(e.revert.name, e.revert.args);

  // MetaMask sometimes nests the revert data, so try to decode it ourselves
  const candidates = [e?.data, e?.info?.error?.data, e?.info?.error?.data?.data, e?.error?.data];
  for (const data of candidates) {
    if (typeof data !== "string" || !readContract) continue;
    try {
      const parsed = readContract.interface.parseError(data);
      if (parsed) return formatError(parsed.name, parsed.args);
    } catch {
      // not one of our errors, try the next one
    }
  }
  return e?.shortMessage || e?.message || String(e);
}
