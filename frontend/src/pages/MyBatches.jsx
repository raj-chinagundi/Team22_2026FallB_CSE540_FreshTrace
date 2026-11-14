// My batches page: the connected wallet sees the batches it holds right now,
// and can update their status or send them to the next stakeholder
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { HOLDER_ROLES, Role, STATUS_NAMES, Status, errorText, labelFor, loadAllBatches, toCelsius, wallets } from "../contract.js";
import { useWallet } from "../wallet.jsx";
import { TxStatus, useTx } from "../tx.jsx";

// The status each role normally sets when it gets the batch
const NEXT_STATUS = {
  [Role.Packer]: Status.Packed,
  [Role.Carrier]: Status.InTransit,
  [Role.DistributionCenter]: Status.AtDistributionCenter,
  [Role.Retailer]: Status.AtRetailer,
};

// One card per batch. Nothing is disabled for flagged or recalled batches on purpose,
// the contract rejects those and we show its error.
function BatchCard({ batch, account, role, run, contract, reload }) {
  const [laterStatus, setLaterStatus] = useState("");
  const [to, setTo] = useState("");
  const [otherAddress, setOtherAddress] = useState("");

  // Wallets that can receive a batch (Packer, Carrier, DC, Retailer), minus yourself
  const receivers = Object.entries(wallets).filter(
    ([name, a]) => HOLDER_ROLES.includes(Role[name]) && a.toLowerCase() !== account.toLowerCase()
  );
  const next = NEXT_STATUS[role];
  const laterStatuses = STATUS_NAMES.map((name, i) => [i, name]).filter(([i]) => i > batch.status);

  async function setStatus(newStatus) {
    const receipt = await run(() => contract.updateStatus(batch.id, newStatus));
    if (receipt) await reload();
  }

  async function transfer(e) {
    e.preventDefault();
    const target = to === "other" ? otherAddress.trim() : to;
    if (!ethers.isAddress(target)) {
      alert("Pick a wallet or type a valid address");
      return;
    }
    const receipt = await run(() => contract.transferCustody(batch.id, target));
    if (receipt) await reload();   // the batch leaves this list once it's sent
  }

  return (
    <section className="card">
      <div className="row space-between">
        <h2>
          <Link to={`/batch/${batch.id}`}>#{batch.id}</Link> {batch.product}
        </h2>
        <div>
          {batch.recalled && <span className="tag tag-red">RECALLED</span>}
          {batch.flagged && <span className="tag tag-orange">FLAGGED</span>}
        </div>
      </div>
      <p>
        {batch.quantityKg} kg · Status: <strong>{STATUS_NAMES[batch.status]}</strong> · Safe range{" "}
        {toCelsius(batch.minLimit)} to {toCelsius(batch.maxLimit)}
      </p>

      <div className="row">
        {next !== undefined && next > batch.status && (
          <button onClick={() => setStatus(next)}>Mark as {STATUS_NAMES[next]}</button>
        )}
        <select value={laterStatus} onChange={(e) => setLaterStatus(e.target.value)}>
          <option value="">Other status…</option>
          {laterStatuses.map(([i, name]) => <option key={i} value={i}>{name}</option>)}
        </select>
        <button className="secondary" disabled={laterStatus === ""} onClick={() => setStatus(Number(laterStatus))}>
          Set status
        </button>
      </div>

      <form className="row" style={{ marginTop: 12 }} onSubmit={transfer}>
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Send to…</option>
          {receivers.map(([name, a]) => <option key={name} value={a}>{labelFor(a)}</option>)}
          <option value="other">Other address</option>
        </select>
        {to === "other" && (
          <input value={otherAddress} onChange={(e) => setOtherAddress(e.target.value)} placeholder="0x…" />
        )}
        <button type="submit">Transfer</button>
      </form>
    </section>
  );
}

export default function MyBatches() {
  const { account, role, contract, connect, hasMetaMask } = useWallet();
  const { status, run } = useTx();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reads every batch and keeps the ones this wallet holds
  async function load() {
    if (!account) return;
    setLoading(true);
    setError("");
    try {
      const all = await loadAllBatches();
      setBatches(all.filter((b) => b.currentHolder.toLowerCase() === account.toLowerCase()));
    } catch (e) {
      setError(errorText(e));
    }
    setLoading(false);
  }

  // Reload when the account changes in MetaMask
  useEffect(() => { load(); }, [account]);

  if (!account) {
    return (
      <section className="card">
        <h1>My batches</h1>
        {hasMetaMask ? <button onClick={connect}>Connect MetaMask</button> : <p>Connect MetaMask to see your batches.</p>}
      </section>
    );
  }

  return (
    <div>
      <section className="card">
        <div className="row space-between">
          <h1>My batches</h1>
          <button className="secondary" onClick={load}>Refresh</button>
        </div>
        <p className="muted">Batches held by {labelFor(account)}. Only the current holder can move a batch.</p>
        <TxStatus status={status} />
      </section>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && batches.length === 0 && (
        <section className="card"><p>You don't hold any batches.</p></section>
      )}
      {batches.map((b) => (
        <BatchCard key={b.id} batch={b} account={account} role={role} run={run} contract={contract} reload={load} />
      ))}
    </div>
  );
}
