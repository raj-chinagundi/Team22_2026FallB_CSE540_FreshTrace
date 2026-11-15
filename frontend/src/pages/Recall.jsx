// Recall page: the regulator recalls a batch with a reason, which freezes it for good.
// Anyone can see the list, but only a Regulator wallet can send the recall.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Role, STATUS_NAMES, errorText, labelFor, loadAllBatches } from "../contract.js";
import { useWallet } from "../wallet.jsx";
import { TxStatus, useTx } from "../tx.jsx";

// One row per batch. Only the regulator gets the reason box and button,
// and recalled batches don't get one since there's nothing left to do.
function BatchRow({ batch, canRecall, onRecall }) {
  const [reason, setReason] = useState("");

  return (
    <tr>
      <td><Link to={`/batch/${batch.id}`}>#{batch.id}</Link></td>
      <td>{batch.product}</td>
      <td>{STATUS_NAMES[batch.status]}</td>
      <td>{labelFor(batch.currentHolder)}</td>
      <td>
        {batch.recalled && <span className="tag tag-red">RECALLED</span>}
        {batch.flagged && <span className="tag tag-orange">FLAGGED</span>}
      </td>
      <td>
        {batch.recalled ? (
          <span className="muted">recalled</span>
        ) : canRecall && (
          <form className="row" onSubmit={(e) => { e.preventDefault(); onRecall(batch.id, reason); }}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
            <button type="submit" className="danger">Recall</button>
          </form>
        )}
      </td>
    </tr>
  );
}

export default function Recall() {
  const { role, contract } = useWallet();
  const { status, run } = useTx();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [recalledId, setRecalledId] = useState(null);
  const [manualId, setManualId] = useState("");
  const [manualReason, setManualReason] = useState("");

  // Reads every batch, flagged ones first so the regulator sees them right away
  async function load() {
    setLoading(true);
    setError("");
    try {
      const all = await loadAllBatches();
      all.sort((a, b) => Number(b.flagged) - Number(a.flagged) || a.id - b.id);
      setBatches(all);
    } catch (e) {
      setError(errorText(e));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Sends recallBatch. Recalling twice isn't blocked here, the contract answers BatchIsRecalled.
  async function recall(id, reason) {
    setNote("");
    setRecalledId(null);
    if (!id || Number(id) < 1) {
      setNote("Enter a batch ID");
      return false;
    }
    if (!reason.trim()) {
      setNote("Enter a reason for the recall (like \"Cooling failure in transit\")");
      return false;
    }
    const receipt = await run(() => contract.recallBatch(id, reason.trim()));
    if (!receipt) return false;
    setRecalledId(Number(id));
    await load();
    return true;
  }

  async function manualRecall(e) {
    e.preventDefault();
    if (await recall(manualId, manualReason)) {
      setManualId("");
      setManualReason("");
    }
  }

  const isRegulator = role === Role.Regulator;

  return (
    <div>
      <section className="card">
        <div className="row space-between">
          <h1>Recall a batch</h1>
          <button className="secondary" onClick={load}>Refresh</button>
        </div>
        <p className="muted">A recalled batch can't be transferred or updated anymore, and the customer page shows it in red.</p>
        {!isRegulator && <p className="warning">Connect a Regulator wallet to recall a batch.</p>}

        {isRegulator && (
          <form className="form" onSubmit={manualRecall}>
            <label>Batch ID <input type="number" min="1" value={manualId} onChange={(e) => setManualId(e.target.value)} /></label>
            <label>Reason <input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="Cooling failure in transit" /></label>
            <div><button type="submit" className="danger">Recall</button></div>
          </form>
        )}

        {note && <p className="error">{note}</p>}
        <TxStatus status={status} />
        {recalledId && (
          <p><strong>Batch #{recalledId} recalled.</strong> <Link to={`/batch/${recalledId}`}>See what the customer sees</Link></p>
        )}
      </section>

      <section className="card">
        <h2>All batches</h2>
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && batches.length === 0 && <p>No batches yet.</p>}
        {batches.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>Product</th><th>Status</th><th>Holder</th><th>Flags</th><th>{isRegulator ? "Recall" : ""}</th></tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <BatchRow key={b.id} batch={b} canRecall={isRegulator} onRecall={recall} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

