// Networks: the default hardhat network for tests, localhost (npx hardhat node)
// and amoy (Polygon testnet). Keys and the RPC URL are read from .env.
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ quiet: true });

const { AMOY_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    amoy: {
      url: AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  // REPORT_GAS=true npx hardhat test prints gas used per function
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
  },
};
