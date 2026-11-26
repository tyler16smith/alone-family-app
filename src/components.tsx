import { useState } from "react";
import type { Location, Player } from "../shared/types";
import { api, ApiError, setHostKey, type LocationPick } from "./api";

/** Preset location cards plus a "somewhere else" card; calls onSubmit with the pick. */
export function LocationPicker({ locations, initialId, actionLabel, busyLabel, onSubmit, extra }: {
  locations: Location[];
  initialId?: string;
  actionLabel: string;
  busyLabel: string;
  onSubmit: (pick: LocationPick) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const [value, setValue] = useState(initialId && locations.some((l) => l.id === initialId) ? initialId : locations[0]?.id ?? "");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isCustom = value === "custom";

  async function submit() {
    setBusy(true); setErr("");
    try { await onSubmit(isCustom ? { customName: custom.trim() } : { locationId: value }); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="loc-grid">
        {locations.map((l) => (
          <button key={l.id} className={`loc ${value === l.id ? "on" : ""}`} onClick={() => setValue(l.id)}>
            <div className="loc-name">{l.name}</div>
            <div className="loc-blurb">{l.blurb}</div>
            <div className="loc-meters">
              <Meter label="Cold" v={l.cold} />
              <Meter label="Wet" v={l.wet} />
              <Meter label="Food" v={l.foodAbundance} />
              <Meter label="Predators" v={l.predators} />
            </div>
          </button>
        ))}
        <div className={`loc custom ${isCustom ? "on" : ""}`} onClick={() => setValue("custom")}>
          <div className="loc-name">Somewhere else…</div>
          <div className="loc-blurb">Type any place, real or ridiculous. AI sets the conditions.</div>
          <input
            className="input"
            placeholder="e.g. Yellowstone, the Sahara, Grandma's backyard"
            maxLength={80}
            value={custom}
            onFocus={() => setValue("custom")}
            onChange={(e) => setCustom(e.target.value)}
          />
        </div>
      </div>
      <div className="row end">
        {extra}
        <button className="btn big" disabled={busy || !value || (isCustom && !custom.trim())} onClick={submit}>
          {busy ? busyLabel : actionLabel}
        </button>
      </div>
      {err && <p className="error">{err}</p>}
    </>
  );
}

export function Meter({ label, v, max = 10 }: { label: string; v: number; max?: number }) {
  return (
    <div className="meter">
      <span>{label}</span>
      <div className="meter-track"><div className="meter-fill" style={{ width: `${(v / max) * 100}%` }} /></div>
      <b>{Math.round(v * 10) / 10}</b>
    </div>
  );
}

export function PlayerDetail({ p }: { p: Player }) {
  return (
    <div className="detail">
      <h3>Bio</h3>
      <p className={p.bio ? "" : "muted"}>{p.bio || "No bio yet."}</p>
      <h3>Items ({p.items.length})</h3>
      {p.items.length ? (
        <div className="chips">{p.items.map((i) => <span key={i} className="chip">{i}</span>)}</div>
      ) : <p className="muted">Nothing packed yet.</p>}
      <h3>Skills</h3>
      <p className={p.skills ? "" : "muted"}>{p.skills || "No skills listed."}</p>
    </div>
  );
}

export function HostKeyPrompt({ onDone }: { onDone: () => void }) {
  const [k, setK] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="page narrow">
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setHostKey(k.trim());
          try { await api.hostCheck(); onDone(); }
          catch (e2) { setErr(e2 instanceof ApiError && e2.status === 401 ? "That key didn't work." : (e2 as Error).message); }
        }}
      >
        <h2>Host key</h2>
        <p className="muted">Only the host can start seasons and run simulations.</p>
        <input className="input" type="password" autoFocus value={k} onChange={(e) => setK(e.target.value)} />
        <button className="btn full">Continue</button>
        {err && <p className="error">{err}</p>}
      </form>
    </div>
  );
}
