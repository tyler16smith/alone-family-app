import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Cause, SeasonState, SimResult } from "../../shared/types";
import { Meter, PlayerDetail } from "../components";

// Dark tooltip with light text (Recharts defaults the item text to black).
const TOOLTIP = {
  contentStyle: { background: "#16241d", border: "1px solid #2c4136", borderRadius: 10 },
  labelStyle: { color: "#eef0e8", fontWeight: 700 },
  itemStyle: { color: "#ffd166" },
};

const CAUSE_LABEL: Record<Cause, string> = {
  winner: "Winner",
  starvation: "Starvation",
  exposure: "Cold & wet",
  injury: "Injury",
  mental: "Missed home",
  rescued: "Needed rescuing",
};

export default function Results({ result, state, simulating, onRerun, onBack }: {
  result: SimResult; state: SeasonState; simulating: boolean; onRerun: () => void; onBack: () => void;
}) {
  const winner = result.featured[0];
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const end = Date.now() + 2500;
    const colors = ["#ff7a1a", "#ffd166", "#f4f1de", "#81b29a"];
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [result.id]);

  const stat = (id: number) => result.stats.find((s) => s.playerId === id);
  const open = state.players.find((p) => p.id === openId);
  const openStat = openId ? stat(openId) : undefined;
  const winChart = result.stats.map((s) => ({ name: s.name, win: s.winPct, id: s.playerId })).sort((a, b) => b.win - a.win);

  return (
    <div className="results">
      <div className="row between top-bar">
        <button className="link" onClick={onBack}>← Roster</button>
        <div className="muted small">
          {state.season.location.name} · {result.runs.toLocaleString()} simulated seasons
          {result.scoredBy === "keywords" && " · scored by keywords (add ANTHROPIC_API_KEY for AI scoring)"}
        </div>
        <button className="btn fire" disabled={simulating} onClick={onRerun}>{simulating ? "Simulating…" : "Run it again"}</button>
      </div>

      <section className="winner">
        <div className="eyebrow">Winner</div>
        <h1>{winner.name}</h1>
        <div className="days"><b>{winner.day}</b> days</div>
        <p className="reason">{winner.reason}</p>
        <p className="muted">Wins {stat(winner.playerId)?.winPct ?? 0}% of all simulated seasons</p>
      </section>

      <section className="card recap"><p>{result.recap}</p></section>

      <div className="results-grid">
        <section className="card">
          <h2>How the season went</h2>
          <ol className="finish">
            {result.featured.map((f) => (
              <li key={f.playerId} className={f.place === 1 ? "first" : ""} onClick={() => setOpenId(f.playerId)}>
                <span className="place">{f.place}</span>
                <div className="finish-body">
                  <div className="row between">
                    <b>{f.name}</b>
                    <span className={`cause c-${f.cause}`}>{f.place === 1 ? `Won · day ${f.day}` : `Day ${f.day} · ${CAUSE_LABEL[f.cause]}`}</span>
                  </div>
                  {f.place !== 1 && <div className="muted small">{f.reason}</div>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="stack">
          <section className="card">
            <h2>Chance to win</h2>
            <p className="muted small">Share of the {result.runs.toLocaleString()} simulated seasons each person won</p>
            <ResponsiveContainer width="100%" height={Math.max(160, winChart.length * 34)}>
              <BarChart data={winChart} layout="vertical" margin={{ left: 10, right: 30 }}>
                <XAxis type="number" unit="%" stroke="#9aa59d" fontSize={12} />
                <YAxis type="category" dataKey="name" width={90} stroke="#c8d0ca" fontSize={13} />
                <Tooltip formatter={(v) => [`${v}%`, "Win chance"]} {...TOOLTIP} cursor={{ fill: "#ffffff0d" }} />
                <Bar dataKey="win" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "#c8d0ca", fontSize: 12, formatter: (v: unknown) => `${v}%` }}>
                  {winChart.map((d, i) => <Cell key={d.id} fill={i === 0 ? "#ff7a1a" : "#5f8f73"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="card">
            <h2>Still in the game</h2>
            <p className="muted small">Average share of contestants left, by day</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={result.survival} margin={{ left: -10, right: 10 }}>
                <CartesianGrid stroke="#243a2f" vertical={false} />
                <XAxis dataKey="day" stroke="#9aa59d" fontSize={12} />
                <YAxis unit="%" stroke="#9aa59d" fontSize={12} domain={[0, 100]} />
                <Tooltip formatter={(v) => [`${v}%`, "Still in"]} cursor={{ stroke: "#ff7a1a66" }} labelFormatter={(d) => `Day ${d}`} {...TOOLTIP} />
                <Area dataKey="pctIn" stroke="#ff7a1a" fill="#ff7a1a33" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </section>
        </div>
      </div>

      {open && openStat && (
        <aside className="panel">
          <div className="row between">
            <h2>{open.name}</h2>
            <button className="link" onClick={() => setOpenId(null)}>Close ✕</button>
          </div>
          <p className="note">“{openStat.scores.note}”</p>
          <div className="scores">
            <Meter label="Shelter" v={openStat.scores.shelter} />
            <Meter label="Fire" v={openStat.scores.fire} />
            <Meter label="Food" v={openStat.scores.food} />
            <Meter label="Fitness" v={openStat.scores.fitness} />
            <Meter label="Mental" v={openStat.scores.mental} />
            <Meter label="Injury risk" v={openStat.scores.injuryRisk} />
            {openStat.scores.independence !== undefined && <Meter label="Can go it alone" v={openStat.scores.independence} />}
          </div>
          <p className="muted small">
            Wins {openStat.winPct}% · average place {openStat.avgPlace} · usually out around day {openStat.medianDayOut}
            {openStat.topCause !== "winner" && ` (most often: ${CAUSE_LABEL[openStat.topCause].toLowerCase()})`}
          </p>
          <PlayerDetail p={open} />
        </aside>
      )}
    </div>
  );
}
