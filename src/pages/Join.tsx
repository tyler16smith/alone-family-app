import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Join() {
  const [code, setCode] = useState("");
  const nav = useNavigate();
  return (
    <div className="page narrow">
      <header className="hero-title small">
        <h1>ALONE</h1>
        <p className="sub">Enter the season code on the TV</p>
      </header>
      <form className="card" onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav(`/s/${code.trim().toUpperCase()}`); }}>
        <input className="code-input" maxLength={6} autoFocus placeholder="ABCDEF" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button className="btn big full" disabled={code.trim().length !== 6}>Join</button>
      </form>
    </div>
  );
}
