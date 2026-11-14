// Keeps track of the connected MetaMask account and its role, and gives pages a
// contract object that can send transactions. Pages use it through useWallet().
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ethers } from "ethers";
import { NET, deployment, readContract } from "./contract.js";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const eth = window.ethereum;   // undefined when MetaMask isn't installed (customer phone)
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [role, setRole] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [contract, setContract] = useState(null);

  const wrongNetwork = Boolean(NET) && account !== null && chainId !== null && chainId !== NET.chainId;

  // On load only ask for accounts we already have access to (no popup), then
  // follow account and network changes made in MetaMask
  useEffect(() => {
    if (!eth) return;
    eth.request({ method: "eth_accounts" }).then((accounts) => setAccount(accounts[0] ?? null));
    eth.request({ method: "eth_chainId" }).then((id) => setChainId(Number(id)));

    const onAccounts = (accounts) => setAccount(accounts[0] ?? null);
    const onChain = () => window.location.reload();   // simplest way to reset everything
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener("accountsChanged", onAccounts);
      eth.removeListener("chainChanged", onChain);
    };
  }, [eth]);

  // Read the role of the connected account from the contract
  const refreshRole = useCallback(async () => {
    if (!account || !readContract) {
      setRole(0);
      setIsAdmin(false);
      return;
    }
    const [r, admin] = await Promise.all([readContract.roleOf(account), readContract.admin()]);
    setRole(Number(r));
    setIsAdmin(admin.toLowerCase() === account.toLowerCase());
  }, [account]);

  useEffect(() => {
    refreshRole().catch(() => setRole(0));
  }, [refreshRole]);

  // Contract with the MetaMask signer, only when we're on the right network
  useEffect(() => {
    let cancelled = false;
    setContract(null);
    if (!eth || !account || !deployment || wrongNetwork) return;
    const provider = new ethers.BrowserProvider(eth);
    provider.getSigner(account)
      .then((signer) => {
        if (!cancelled) setContract(new ethers.Contract(deployment.address, deployment.abi, signer));
      })
      .catch((e) => console.error(e));
    return () => { cancelled = true; };
  }, [eth, account, wrongNetwork]);

  // Asks MetaMask to connect (this one does show the popup)
  async function connect() {
    if (!eth) {
      alert("MetaMask isn't installed in this browser");
      return;
    }
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0] ?? null);
  }

  // Switches MetaMask to our network, and adds it first if MetaMask doesn't know it (error 4902)
  async function switchNetwork() {
    const hexId = ethers.toQuantity(NET.chainId);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
    } catch (e) {
      const code = e?.code ?? e?.data?.originalError?.code;
      if (code !== 4902) throw e;
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hexId,
          chainName: NET.label,
          rpcUrls: [NET.rpcUrl],
          nativeCurrency: NET.explorer
            ? { name: "POL", symbol: "POL", decimals: 18 }
            : { name: "ETH", symbol: "ETH", decimals: 18 },
          blockExplorerUrls: NET.explorer ? [NET.explorer] : undefined,
        }],
      });
    }
  }

  const value = { hasMetaMask: Boolean(eth), account, role, isAdmin, wrongNetwork, contract, connect, switchNetwork, refreshRole };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

// { account, role, isAdmin, wrongNetwork, contract, connect, switchNetwork, refreshRole }
export function useWallet() {
  return useContext(WalletContext);
}
