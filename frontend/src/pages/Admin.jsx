// Admin page: shows the role of each team wallet and lets the admin set roles
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { ROLE_NAMES, errorText, readContract, wallets } from "../contract.js";
import { useWallet } from "../wallet.jsx";
import { TxStatus, useTx } from "../tx.jsx";

export default function Admin() {
  const { account, isAdmin, contract, refreshRole } = useWallet();
  const { status, run } = useTx();
  const [roles, setRoles] = useState({});        // address -> role number, read from the contract
  const [address, setAddress] = useState("");
  const [newRole, setNewRole] = useState(1);
  const [checkAddress, setCheckAddress] = useState("");
  const [checkResult, setCheckResult] = useState("");

  // Reads the current role of every wallet saved by setup-roles.js
  async function loadRoles() {
    const entries = await Promise.all(
      Object.values(wallets).map(async (a) => [a, Number(await readContract.roleOf(a))])
    );
    setRoles(Object.fromEntries(entries));
  }

  useEffect(() => { loadRoles().catch(console.error); }, []);

  // Admin gives a wallet a role (setRole only works from the deployer)
  async function submitRole(e) {
    e.preventDefault();
    if (!ethers.isAddress(address.trim())) {
      alert("That isn't a valid address");
      return;
    }
    const receipt = await run(() => contract.setRole(address.trim(), newRole));
    if (receipt) {
      await loadRoles();
      await refreshRole();   // in case the admin changed their own role
    }
  }

  // Anyone can look up the role of an address
  async function checkRole(e) {
    e.preventDefault();
    try {
      const r = await readContract.roleOf(checkAddress.trim());
      setCheckResult(ROLE_NAMES[Number(r)]);
    } catch (err) {
      setCheckResult(errorText(err));
    }
  }

  return (
    <div>
      <section className="card">
        <h1>Admin</h1>
        <p className="muted">
          The admin is the wallet that deployed the contract. It's the only one that can call
          setRole. Every wallet has one role, and each contract function checks it.
        </p>
        {account && !isAdmin && <p className="warning">Connect the admin wallet to change roles.</p>}
      </section>

      <section className="card">
        <h2>Team wallets</h2>
        {Object.keys(wallets).length === 0 ? (
          <p className="muted">No wallets saved yet. Run the setup-roles script.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Wallet</th><th>Address</th><th>Role on-chain</th></tr>
              </thead>
              <tbody>
                {Object.entries(wallets).map(([name, a]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td className="mono">{a}</td>
                    <td>{roles[a] === undefined ? "…" : ROLE_NAMES[roles[a]]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Set role</h2>
        <form className="form" onSubmit={submitRole}>
          <label>
            Wallet address
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" />
          </label>
          <label>
            Role
            <select value={newRole} onChange={(e) => setNewRole(Number(e.target.value))}>
              {ROLE_NAMES.map((name, i) => <option key={name} value={i}>{name}</option>)}
            </select>
          </label>
          <button type="submit">Set role</button>
        </form>
        <TxStatus status={status} />
      </section>

      <section className="card">
        <h2>Check role</h2>
        <form className="row" onSubmit={checkRole}>
          <input value={checkAddress} onChange={(e) => setCheckAddress(e.target.value)} placeholder="0x…" />
          <button type="submit" className="secondary">Check</button>
        </form>
        {checkResult && <p>Role: <strong>{checkResult}</strong></p>}
      </section>
    </div>
  );
}
