import { useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Role, fromCelsius, ipfsLink } from "../contract.js";
import { useWallet } from "../wallet.jsx";
import { TxStatus, useTx } from "../tx.jsx";

export default function RegisterBatch() {
  const { role, contract } = useWallet();
  const { status, run } = useTx();
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [minC, setMinC] = useState("");
  const [maxC, setMaxC] = useState("");
  const [cid, setCid] = useState("");
  const [newId, setNewId] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!product.trim() || !cid.trim()) {
      alert("Product and certificate CID can't be empty");
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      alert("Quantity has to be a whole number of kg above 0");
      return;
    }
    if (minC.trim() === "" || maxC.trim() === "" || isNaN(Number(minC)) || isNaN(Number(maxC))) {
      alert("Enter the safe min and max in °C");
      return;
    }
    setNewId(null);
    const receipt = await run(() =>
      contract.registerBatch(product.trim(), qty, fromCelsius(minC), fromCelsius(maxC), cid.trim())
    );
    if (receipt) {
      const event = receipt.logs.find((l) => l.fragment?.name === "BatchRegistered");
      setNewId(Number(event.args.batchId));
      setProduct("");
      setQuantity("");
      setMinC("");
      setMaxC("");
      setCid("");
    }
  }

  if (role !== Role.Farmer) {
    return (
      <section className="card">
        <h1>Register batch</h1>
        <p className="warning">Connect a Farmer wallet to register a batch.</p>
      </section>
    );
  }

  const url = newId && `${window.location.origin}/batch/${newId}`;

  return (
    <div>
      <section className="card">
        <h1>Register batch</h1>
        <p className="muted">
          The farmer registers a new batch of produce with its safe temperature range and food safety
          certificate. The farmer becomes the first holder and the status starts at Harvested.
        </p>
        <form className="form" onSubmit={submit}>
          <label>
            Product
            <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Strawberries" />
          </label>
          <label>
            Quantity (kg)
            <input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label>
            Safe min (°C)
            <input type="number" step="0.1" value={minC} onChange={(e) => setMinC(e.target.value)} />
          </label>
          <label>
            Safe max (°C)
            <input type="number" step="0.1" value={maxC} onChange={(e) => setMaxC(e.target.value)} />
          </label>
          <label>
            Certificate CID
            <input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="bafy… or Qm…" />
          </label>
          <p className="muted">
            Upload the certificate with <code>npm run upload-cert -- &lt;file&gt;</code> and paste the CID.
            {cid.trim() && (
              <>
                {" "}
                <a href={ipfsLink(cid.trim())} target="_blank" rel="noreferrer">Open certificate</a>
              </>
            )}
          </p>
          <button type="submit">Register batch</button>
        </form>
        <TxStatus status={status} />
      </section>

      {newId && (
        <section className="card">
          <h2>Batch #{newId} registered</h2>
          <p>
            <Link to={`/batch/${newId}`}>Open batch #{newId}</Link>
          </p>
          <QRCodeSVG value={url} size={160} />
          <p className="muted">Print this on the crate</p>
        </section>
      )}
    </div>
  );
}
