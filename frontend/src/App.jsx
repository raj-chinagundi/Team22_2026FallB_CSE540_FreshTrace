// Layout: header with network, contract and connected wallet, the nav, and the routes
import { NavLink, Route, Routes } from "react-router-dom";
import { NET, NETWORK, ROLE_NAMES, addressLink, deployment, labelFor, shortAddr } from "./contract.js";
import { useWallet } from "./wallet.jsx";
import Home from "./pages/Home.jsx";
import Admin from "./pages/Admin.jsx";
import RegisterBatch from "./pages/RegisterBatch.jsx";
import MyBatches from "./pages/MyBatches.jsx";
import Recall from "./pages/Recall.jsx";
import VerifyBatch from "./pages/VerifyBatch.jsx";

// Shows who is connected. It's how you can tell which stakeholder is acting.
function WalletInfo() {
  const { hasMetaMask, account, role, isAdmin, wrongNetwork, connect, switchNetwork } = useWallet();

  if (!hasMetaMask) return <span className="muted">No wallet (read only)</span>;
  if (!account) return <button onClick={connect}>Connect MetaMask</button>;
  if (wrongNetwork) {
    return <button className="danger" onClick={switchNetwork}>Switch to {NET.label}</button>;
  }

  const roleName = isAdmin ? "Admin" : ROLE_NAMES[role];
  return (
    <span className="wallet">
      <span className={`role-tag ${role === 0 && !isAdmin ? "role-none" : ""}`}>{roleName}</span>
      {labelFor(account)}
    </span>
  );
}

// Contract address with a Polygonscan link (plain text on localhost)
function ContractInfo() {
  const link = addressLink(deployment.address);
  const text = `Contract ${shortAddr(deployment.address)}`;
  return link ? <a href={link} target="_blank" rel="noreferrer">{text}</a> : <span>{text}</span>;
}

export default function App() {
  return (
    <>
      <header className="header">
        <div className="header-top">
          <NavLink to="/" className="logo">FreshTrace</NavLink>
          <div className="header-info">
            <span className="muted">{NET ? NET.label : NETWORK}</span>
            {deployment && <ContractInfo />}
            {deployment && NET && <WalletInfo />}
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/admin">Admin</NavLink>
          <NavLink to="/register">Register</NavLink>
          <NavLink to="/my-batches">My batches</NavLink>
          <NavLink to="/recall">Recall</NavLink>
        </nav>
      </header>

      <main className="main">
        {!NET && <p className="error">Unknown network "{NETWORK}". Set VITE_NETWORK to localhost or amoy in frontend/.env</p>}
        {NET && !deployment && (
          <p className="error">No deployments/{NETWORK}.json found. Run the deploy script first (see frontend/README.md).</p>
        )}
        {NET && deployment && (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/register" element={<RegisterBatch />} />
            <Route path="/my-batches" element={<MyBatches />} />
            <Route path="/recall" element={<Recall />} />
            <Route path="/batch/:id" element={<VerifyBatch />} />
            <Route path="*" element={<p>Page not found.</p>} />
          </Routes>
        )}
      </main>
    </>
  );
}
