// Home page: what FreshTrace is, a batch lookup box and a table of all batches
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { STATUS_NAMES, errorText, labelFor, loadAllBatches } from "../contract.js";

export default function Home() {
  const navigate = useNavigate();
  const [lookupId, setLookupId] = useState("");
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Reads all batches straight from the contract
  async function load() {
    setLoading(true);
    setError("");
    try {
      setBatches(await loadAllBatches());
    } catch (e) {
      setError(errorText(e));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Opens the customer page for the typed batch ID
  function lookup(e) {
    e.preventDefault();
    if (lookupId.trim()) navigate(`/batch/${lookupId.trim()}`);
  }

  return (
    <div>
      <section className="card">
        <h1>FreshTrace</h1>
        <p>
          One tamper-proof record for each batch of fresh produce, from the farm to the retailer.
          Every handoff, status change, sensor reading and recall is stored on the blockchain, and
          anyone can check a batch without a wallet.
        </p>
        <form className="row" onSubmit={lookup}>
          <input
            type="number"
            min="1"
            placeholder="Batch ID"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
          />
          <button type="submit">Look up batch</button>
        </form>
      </section>

      <section className="card">
        <div className="row space-between">
          <h2>All batches</h2>
          <button className="secondary" onClick={load}>Refresh</button>
        </div>
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && batches.length === 0 && <p className="muted">No batches registered yet.</p>}
        {batches.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>Product</th><th>Status</th><th>Current holder</th><th></th></tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td><Link to={`/batch/${b.id}`}>#{b.id}</Link></td>
                    <td>{b.product}</td>
                    <td>{STATUS_NAMES[b.status]}</td>
                    <td>{labelFor(b.currentHolder)}</td>
                    <td>
                      {b.recalled && <span className="tag tag-red">Recalled</span>}
                      {b.flagged && <span className="tag tag-orange">Flagged</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
