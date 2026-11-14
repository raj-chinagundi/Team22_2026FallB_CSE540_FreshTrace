// Verify batch page: what the customer sees after scanning the QR code.
// Only reads from the contract, so it works without MetaMask.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  NET, STATUS_NAMES, addressLink, deployment, formatTime, ipfsLink, labelFor, readContract, toBatch, toCelsius,
} from "../contract.js";

export default function VerifyBatch() {
  const { id } = useParams();
  const [batch, setBatch] = useState(null);
  const [history, setHistory] = useState([]);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Gets the batch, its journey and its sensor readings at the same time
  async function load() {
    setLoading(true);
    setNotFound(false);
    try {
      const [b, h, r] = await Promise.all([
        readContract.getBatch(id),
        readContract.getHistory(id),
        readContract.getReadings(id),
      ]);
      setBatch(toBatch(b));
      setHistory(h);
      setReadings(r);
    } catch (e) {
      // BatchNotFound, or an ID that isn't a number
      console.error(e);
      setBatch(null);
      setNotFound(true);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  if (loading && !batch) return <p className="muted">Loading batch #{id}…</p>;
  if (notFound) return <section className="card"><h1>Batch #{id} not found</h1></section>;

  const contractLink = addressLink(deployment.address);

  return (
    <div>
      {batch.recalled && <div className="banner banner-red">RECALLED: Recalled by a regulator, do not eat</div>}
      {!batch.recalled && batch.flagged && (
        <div className="banner banner-orange">FLAGGED: A sensor reading was outside the safe range</div>
      )}
      {!batch.recalled && !batch.flagged && <div className="banner banner-green">No flags or recalls recorded</div>}

      <section className="card">
        <div className="row space-between">
          <h1>Batch #{batch.id}: {batch.product}</h1>
          <button className="secondary" onClick={load}>Refresh</button>
        </div>
        <p>Quantity: {batch.quantityKg} kg</p>
        <p>Farmer: {labelFor(batch.farmer)}</p>
        <p>Current holder: {labelFor(batch.currentHolder)}</p>
        <p>Registered: {formatTime(batch.createdAt)}</p>
        <p>Safe range: {toCelsius(batch.minLimit)} to {toCelsius(batch.maxLimit)}</p>
        <p>
          Certificate:{" "}
          <a href={ipfsLink(batch.certificateCID)} target="_blank" rel="noreferrer" className="mono">
            {batch.certificateCID}
          </a>
        </p>
        <div className="steps">
          {STATUS_NAMES.map((name, i) => (
            <span key={name} className={`step ${i < batch.status ? "done" : ""} ${i === batch.status ? "current" : ""}`}>
              {name}
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Journey</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Time</th><th>Holder</th><th>Status</th></tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{formatTime(h.timestamp)}</td>
                  <td>{labelFor(h.holder)}</td>
                  <td>{STATUS_NAMES[Number(h.status)]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Sensor readings</h2>
        {readings.length === 0 ? (
          <p className="muted">No readings yet</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Min</th><th>Max</th><th>Within limits</th><th>Log hash</th></tr>
              </thead>
              <tbody>
                {readings.map((r, i) => (
                  <tr key={i}>
                    <td>{formatTime(r.timestamp)}</td>
                    <td>{toCelsius(r.minValue)}</td>
                    <td>{toCelsius(r.maxValue)}</td>
                    <td className={r.withinLimits ? "" : "error"}>{r.withinLimits ? "Yes" : "No"}</td>
                    {/* full hash in the tooltip, it's too long for a phone */}
                    <td className="mono" title={r.logHash}>{r.logHash.slice(0, 10)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Scan to open on your phone</h2>
        <QRCodeSVG value={window.location.href} size={160} />
      </section>

      <p className="muted">
        Data read directly from the FreshTrace contract on {NET.label}:{" "}
        {contractLink ? (
          <a href={contractLink} target="_blank" rel="noreferrer" className="mono">{deployment.address}</a>
        ) : (
          <span className="mono">{deployment.address}</span>
        )}
      </p>
    </div>
  );
}
