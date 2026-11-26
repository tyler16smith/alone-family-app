import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import type { SeasonState, SimResult } from "../../shared/types";
import { api, ApiError, type Meta } from "../api";
import { HostKeyPrompt, LocationPicker, PlayerDetail } from "../components";
import { lazy, Suspense as ReactSuspense } from "react";
const Results = lazy(() => import("./Results"));

const POLL_MS = 2500;

export default function Host() {
  const code = useParams().code!.toUpperCase();
  const [state, setState] = useState<SeasonState | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [changingLoc, setChangingLoc] = useState(false);
  const [needKey, setNeedKey] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(() => api.season(code).then(setState).catch((e) => setErr(e.message)), [code]);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) setNeedKey(true);
    else setErr((e as Error).message);
  };

  async function simulate() {
    setSimulating(true); setErr("");
    const minWait = new Promise((r) => setTimeout(r, 4500)); // let the suspense breathe
    try { const [r] = await Promise.all([api.simulate(code), minWait]); setResult(r); refresh(); }
    catch (e) { fail(e); }
    finally { setSimulating(false); }
  }

  if (needKey) return <HostKeyPrompt onDone={() => setNeedKey(false)} />;
  if (!state) return <div className="page"><p className="muted center">{err || "Loading season…"}</p></div>;

  if (simulating) return <Suspense players={state.players.map((p) => p.name)} place={state.season.location.name} />;
  if (result) {
    return (
      <ReactSuspense fallback={<div className="page"><p className="muted center">Loading results…</p></div>}>
        <Results result={result} state={state} simulating={simulating} onRerun={simulate} onBack={() => setResult(null)} />
      </ReactSuspense>
    );
  }

  const joinUrl = `${meta?.lanOrigin ?? window.location.origin}/s/${code}`;
  const open = state.players.find((p) => p.id === openId) ?? null;
  const loc = state.season.location;

  return (
    <div className={`host ${open ? "with-panel" : ""}`}>
      <aside className="host-side">
        <div className="eyebrow">Season</div>
        <div className="season-code">{code}</div>
        <div className="qr"><QRCodeSVG value={joinUrl} size={220} marginSize={2} /></div>
        <p className="join-url">Scan to join, or go to <b>{joinUrl.replace(/^https?:\/\//, "").replace(/\/s\/.*/, "")}/join</b></p>
        <div className="loc-badge">
          <div className="eyebrow">Location</div>
          <div className="loc-name">{loc.name}</div>
          <div className="muted small">{loc.blurb}</div>
          <button className="link" onClick={() => setChangingLoc((v) => !v)}>{changingLoc ? "Close" : "Change location"}</button>
        </div>
      </aside>

      <main className="host-main">
        {changingLoc && meta && (
          <section className="card">
            <h2>Change location</h2>
            <LocationPicker
              locations={meta.locations}
              initialId={loc.id}
              actionLabel="Use this location"
              busyLabel="Scouting…"
              onSubmit={async (pick) => {
                try { setState(await api.setLocation(code, pick)); setChangingLoc(false); }
                catch (e) { if (e instanceof ApiError && e.status === 401) setNeedKey(true); else throw e; }
              }}
            />
          </section>
        )}

        <div className="row between">
          <h2 className="section-title">Contestants <span className="count">{state.players.length}</span></h2>
          <div className="row">
            {state.latest && <button className="btn ghost" onClick={() => setResult(state.latest)}>Last results</button>}
            <button className="btn big fire" disabled={state.players.length < 2 || simulating} onClick={simulate}>
              {simulating ? "Simulating 1,000 seasons…" : state.latest ? "Run it again" : "Simulate"}
            </button>
          </div>
        </div>
        {err && <p className="error">{err}</p>}
        {state.players.length < 2 && <p className="muted">Waiting for at least two people to join…</p>}

        <div className="roster">
          {state.players.map((p) => (
            <button key={p.id} className={`roster-row ${openId === p.id ? "on" : ""}`} onClick={() => setOpenId(openId === p.id ? null : p.id)}>
              <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="roster-name">{p.name}</span>
              <span className="muted small">{p.items.length} item{p.items.length === 1 ? "" : "s"}</span>
              <span className={`dot ${p.bio || p.items.length ? "ready" : ""}`} title={p.bio || p.items.length ? "Ready" : "Hasn't filled anything in"} />
            </button>
          ))}
        </div>
      </main>

      {open && (
        <aside className="panel docked">
          <div className="row between">
            <h2>{open.name}</h2>
            <button className="link" onClick={() => setOpenId(null)}>Close ✕</button>
          </div>
          <PlayerDetail p={open} />
          <button
            className="link danger"
            onClick={async () => { if (confirm(`Remove ${open.name} from this season?`)) { try { await api.removePlayer(open.id); setOpenId(null); refresh(); } catch (e) { fail(e); } } }}
          >
            Remove from season
          </button>
        </aside>
      )}
    </div>
  );
}

function Suspense({ players, place }: { players: string[]; place: string }) {
  const lines = [
    `Dropping ${players.length} contestants across ${place} by floatplane…`,
    "Day 1: everyone is very confident.",
    `Day 9: ${players[1] ?? "someone"} is talking to a squirrel.`,
    "Day 23: a storm rolls in. Tarps are tested.",
    `Day 41: ${players[0] ?? "someone"} dreams about pie.`,
    "Day 60: the medical team does weigh-ins…",
    "Running 1,000 seasons…",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, lines.length - 1)), 650);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <div className="suspense">
      <div className="flame">🔥</div>
      <p key={i} className="suspense-line">{lines[i]}</p>
      <div className="suspense-bar"><div style={{ width: `${((i + 1) / lines.length) * 100}%` }} /></div>
    </div>
  );
}
