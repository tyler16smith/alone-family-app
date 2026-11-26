import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Player, SeasonState, SimResult } from "../../shared/types";
import { MAX_ITEMS, MAX_TEXT, QUICK_ITEMS } from "../../shared/data";
import { api } from "../api";

// What each family member sees after scanning the QR code.
export default function Phone() {
  const code = useParams().code!.toUpperCase();
  const storeKey = `alone.player.${code}`;
  const [state, setState] = useState<SeasonState | null>(null);
  const [me, setMe] = useState<Player | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.season(code).then((s) => {
      setState(s);
      const id = Number(localStorage.getItem(storeKey));
      const mine = s.players.find((p) => p.id === id);
      if (mine) setMe(mine);
    }).catch((e) => setErr(e.message));
    // Keep the roster and latest results fresh so phones see the outcome of each simulation.
    const t = setInterval(() => api.season(code).then(setState).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [code, storeKey]);

  if (err) return <div className="page narrow"><div className="card"><h2>Hmm.</h2><p className="error">{err}</p><a className="link" href="/join">Try another code</a></div></div>;
  if (!state) return <div className="page narrow"><p className="muted center">Loading…</p></div>;

  if (!me) {
    return (
      <PickName
        state={state}
        onPick={async (name) => {
          const p = await api.join(code, name);
          localStorage.setItem(storeKey, String(p.id));
          setMe(p);
        }}
      />
    );
  }

  return (
    <>
      {state.latest && <MyResult result={state.latest} playerId={me.id} />}
      <Editor
        key={me.id}
        player={me}
        locationName={state.season.location.name}
        onSwitch={() => { localStorage.removeItem(storeKey); setMe(null); }}
      />
    </>
  );
}

function PickName({ state, onPick }: { state: SeasonState; onPick: (name: string) => Promise<void> }) {
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState("");
  const names = useMemo(() => state.players.map((p) => p.name).sort((a, b) => a.localeCompare(b)), [state.players]);
  const joined = new Set(state.players.filter((p) => p.joined).map((p) => p.name.toLowerCase()));

  const pick = async (n: string) => { setBusy(n); try { await onPick(n); } finally { setBusy(""); } };

  return (
    <div className="page narrow">
      <header className="hero-title small">
        <div className="eyebrow">Season {state.season.code} · {state.season.location.name}</div>
        <h1>Select your name</h1>
      </header>
      {names.length > 0 && (
        <div className="name-list">
          {names.map((n) => (
            <button key={n} className="name-btn" disabled={!!busy} onClick={() => pick(n)}>
              {n} {joined.has(n.toLowerCase()) && <span className="tag">joined</span>}
              {busy === n && " …"}
            </button>
          ))}
        </div>
      )}
      <form className="card" onSubmit={(e) => { e.preventDefault(); if (other.trim()) pick(other.trim()); }}>
        <h3>{names.length ? "I'm not on the list" : "What's your name?"}</h3>
        <input className="input" placeholder="Your name" maxLength={40} value={other} onChange={(e) => setOther(e.target.value)} />
        <button className="btn full" disabled={!other.trim() || !!busy}>Join season</button>
      </form>
    </div>
  );
}

function Editor({ player, locationName, onSwitch }: { player: Player; locationName: string; onSwitch: () => void }) {
  const [bio, setBio] = useState(player.bio);
  const [skills, setSkills] = useState(player.skills);
  const [items, setItems] = useState<string[]>(player.items);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState<"saved" | "dirty" | "saving">("saved");
  const [err, setErr] = useState("");

  const full = items.length >= MAX_ITEMS;
  const dirty = () => setSaved("dirty");
  const addItems = (text: string) => {
    const add = text.split(",").map((s) => s.trim()).filter(Boolean);
    if (!add.length) return;
    setItems((cur) => {
      const next = [...cur];
      for (const a of add) if (next.length < MAX_ITEMS && !next.some((x) => x.toLowerCase() === a.toLowerCase())) next.push(a);
      return next;
    });
    setDraft(""); dirty();
  };
  const removeItem = (i: string) => { setItems((cur) => cur.filter((x) => x !== i)); dirty(); };

  async function save() {
    setSaved("saving"); setErr("");
    try {
      const p = await api.savePlayer({ id: player.id, bio, skills, items });
      setItems(p.items); setSaved("saved");
    } catch (e) { setErr((e as Error).message); setSaved("dirty"); }
  }

  return (
    <div className="page narrow phone">
      <header className="hero-title small">
        <div className="eyebrow">{locationName}</div>
        <h1>{player.name}</h1>
        <button className="link" onClick={onSwitch}>Not you? Switch</button>
      </header>

      <section className="card">
        <label className="label">Bio <Count n={bio.length} /></label>
        <textarea className="input" rows={4} maxLength={MAX_TEXT} placeholder="Who are you? Background, toughness, weaknesses…" value={bio} onChange={(e) => { setBio(e.target.value); dirty(); }} />
      </section>

      <section className="card">
        <label className="label">Items <span className="count">{items.length}/{MAX_ITEMS}</span></label>
        <div className="chips">
          {items.map((i) => (
            <button key={i} className="chip removable" onClick={() => removeItem(i)}>{i} <span aria-hidden>×</span></button>
          ))}
          {!items.length && <span className="muted">Pack up to {MAX_ITEMS} items.</span>}
        </div>
        <form className="add-row" onSubmit={(e) => { e.preventDefault(); addItems(draft); }}>
          <input className="input" disabled={full} placeholder={full ? "Bag's full. Remove something to swap" : "Add an item (commas OK)"} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button className="btn" disabled={full || !draft.trim()}>Add</button>
        </form>
        <div className="quick">
          {QUICK_ITEMS.filter((q) => !items.some((i) => i.toLowerCase() === q.toLowerCase())).map((q) => (
            <button key={q} className="chip ghost" disabled={full} onClick={() => addItems(q)}>+ {q}</button>
          ))}
        </div>
      </section>

      <section className="card">
        <label className="label">Skills <Count n={skills.length} /></label>
        <textarea className="input" rows={4} maxLength={MAX_TEXT} placeholder="Fishing, hunting, building, fire, first aid, stubbornness…" value={skills} onChange={(e) => { setSkills(e.target.value); dirty(); }} />
      </section>

      <div className="save-bar">
        {err && <span className="error">{err}</span>}
        <button className="btn big full" disabled={saved !== "dirty"} onClick={save}>
          {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className={`count ${n > MAX_TEXT - 40 ? "warn" : ""}`}>{n}/{MAX_TEXT}</span>;
}

function MyResult({ result, playerId }: { result: SimResult; playerId: number }) {
  const winner = result.featured[0];
  const mine = result.featured.find((f) => f.playerId === playerId);
  const odds = result.stats.find((s) => s.playerId === playerId);
  const ordinal = (n: number) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? "th");
  return (
    <div className="my-result">
      {mine ? (
        mine.place === 1 ? (
          <><div className="eyebrow">Latest season</div><h2>🏆 You won! {mine.day} days.</h2></>
        ) : (
          <>
            <div className="eyebrow">Latest season · {winner.name} won ({winner.day} days)</div>
            <h2>You finished {ordinal(mine.place)}, out on day {mine.day}</h2>
            <p>{mine.reason}</p>
          </>
        )
      ) : (
        <><div className="eyebrow">Latest season</div><h2>{winner.name} won after {winner.day} days</h2><p>You joined after that run. You'll be in the next one.</p></>
      )}
      {odds && <p className="muted small">Your odds across {result.runs.toLocaleString()} seasons: {odds.winPct}% to win · average place {odds.avgPlace}. Tweak your items and skills, save, and ask for a rerun.</p>}
    </div>
  );
}
