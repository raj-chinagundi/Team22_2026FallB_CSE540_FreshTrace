// Sends a transaction and shows what's happening, so every page looks the same:
// confirm in MetaMask -> pending -> confirmed (or the error in red).
import { useState } from "react";
import { NET, errorText, txLink } from "./contract.js";
import { useWallet } from "./wallet.jsx";

// const { status, run } = useTx();
// const receipt = await run(() => contract.updateStatus(id, newStatus));   // null if it failed
export function useTx() {
  const { account, wrongNetwork, contract } = useWallet();
  const [status, setStatus] = useState(null);

  async function run(send) {
    if (!account) {
      setStatus({ kind: "error", text: "Connect MetaMask first" });
      return null;
    }
    if (wrongNetwork || !contract) {
      setStatus({ kind: "error", text: `Switch MetaMask to ${NET.label} first` });
      return null;
    }
    try {
      setStatus({ kind: "wait", text: "Confirm the transaction in MetaMask…" });
      const tx = await send();
      setStatus({ kind: "wait", text: "Pending…", hash: tx.hash });
      const receipt = await tx.wait();
      setStatus({ kind: "ok", text: `Confirmed in block ${receipt.blockNumber}`, hash: tx.hash });
      return receipt;
    } catch (e) {
      console.error(e);
      setStatus({ kind: "error", text: errorText(e) });
      return null;
    }
  }

  return { status, run };
}

// Shows the current status from useTx()
export function TxStatus({ status }) {
  if (!status) return null;
  const link = status.hash ? txLink(status.hash) : null;
  return (
    <div className={`tx tx-${status.kind}`}>
      {status.text}
      {status.hash && (
        <div className="tx-hash">
          Tx: {link ? <a href={link} target="_blank" rel="noreferrer">{status.hash}</a> : status.hash}
        </div>
      )}
    </div>
  );
}
