import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import type { Cause, Finish, SeasonState, SimResult } from "../../shared/types";

const CAUSE: Record<Cause, string> = {
  winner: "Winner",
  starvation: "Starvation",
  exposure: "Cold & wet",
  injury: "Injury",
  mental: "Missed home",
  rescued: "Needed rescuing",
};

const ordinal = (n: number) => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th");

// Same shuffle every time for a given result, so going back and forth keeps the order.
function shuffled<T>(xs: T[], seed: number) {
  const out = [...xs];
  let a = seed >>> 0 || 1;
  const rand = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Slide = { kind: "title" } | { kind: "person"; f: Finish; n: number } | { kind: "final" };

export default function Slideshow({ result, state, onClose }: { result: SimResult; state: SeasonState; onClose: () => void }) {
  const loc = state.season.location;
  const total = result.featured.length;
  const slides: Slide[] = useMemo(() => [
    { kind: "title" },
    ...shuffled(result.featured, result.id * 7919 + result.seed).map((f, i) => ({ kind: "person" as const, f, n: i + 1 })),
    { kind: "final" },
  ], [result]);
  const [i, setI] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const next = useCallback(() => setI((v) => Math.min(v + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setI((v) => Math.max(v - 1, 0)), []);
  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  }, [onClose]);

  useEffect(() => {
    root.current?.requestFullscreen?.().catch(() => {}); // browsers may refuse; the slideshow works either way
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", " ", "Enter", "PageDown"].includes(e.key)) { e.preventDefault(); next(); }
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); prev(); }
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, close]);

  const slide = slides[i];
  useEffect(() => {
    const isWinner = slide.kind === "person" && slide.f.place === 1;
    if (!isWinner && slide.kind !== "final") return;
    const colors = ["#ff7a1a", "#ffd166", "#f4f1de", "#81b29a"];
    confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 }, colors });
  }, [slide]);

  const stat = (id: number) => result.stats.find((s) => s.playerId === id);

  return (
    <div className="deck" ref={root} onClick={(e) => (e.clientX > window.innerWidth / 3 ? next() : prev())}>
      <button className="deck-close" onClick={(e) => { e.stopPropagation(); close(); }}>✕ Exit</button>

      <div className="deck-slide" key={i}>
        {slide.kind === "title" && (
          <div className="deck-title">
            <div className="eyebrow">Alone · Family Edition</div>
            <h1>{loc.name}</h1>
            <p className="deck-sub">{total} contestants. {result.runs.toLocaleString()} simulated seasons. One survivor.</p>
            <p className="muted">Press → or click to begin</p>
          </div>
        )}

        {slide.kind === "person" && (() => {
          const { f, n } = slide;
          const won = f.place === 1;
          const s = stat(f.playerId);
          return (
            <div className={`deck-person ${won ? "won" : ""}`}>
              <div className="eyebrow">Contestant {n} of {total}</div>
              <h1 className="deck-name">{f.name}</h1>
              {f.headline && <div className="deck-headline">“{f.headline}”</div>}
              <div className="deck-days">
                <span className="deck-days-label">{won ? "Won after" : "Lasted"}</span>
                <b>{f.day}</b> <span>day{f.day === 1 ? "" : "s"}</span>
              </div>
              <div className={`deck-badge ${won ? "gold" : ""}`}>
                {won ? "🏆 Last one standing" : `${ordinal(f.place)} of ${total} · ${CAUSE[f.cause]}`}
              </div>
              <div className="deck-facts">
                {f.facts && <Fact icon="⚖️" v={`${f.facts.lbsLost} lbs`} label="lost" />}
                {f.facts && <Fact icon="🐟" v={f.facts.mealsCaught} label={f.facts.mealsCaught === 1 ? "meal caught" : "meals caught"} />}
                {f.facts && <Fact icon="⛈️" v={f.facts.storms} label={f.facts.storms === 1 ? "storm survived" : "storms survived"} />}
                {f.facts && <Fact icon="🐾" v={f.facts.predatorScares} label={`run-ins with ${loc.predatorName}`} />}
                {s && <Fact icon="🎲" v={`${s.winPct}%`} label={`of ${result.runs.toLocaleString()} seasons won`} />}
              </div>
              <p className="deck-reason">{f.reason}</p>
            </div>
          );
        })()}

        {slide.kind === "final" && (
          <div className="deck-final">
            <div className="eyebrow">Final standings · {loc.name}</div>
            <ol>
              {result.featured.map((f) => (
                <li key={f.playerId} className={f.place === 1 ? "first" : ""}>
                  <span className="place">{f.place === 1 ? "🏆" : f.place}</span>
                  <b>{f.name}</b>
                  <span className="muted">{f.place === 1 ? `won · day ${f.day}` : `day ${f.day} · ${CAUSE[f.cause]}`}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="deck-progress"><div style={{ width: `${((i + 1) / slides.length) * 100}%` }} /></div>
      <div className="deck-count">{i + 1} / {slides.length}</div>
    </div>
  );
}

function Fact({ icon, v, label }: { icon: string; v: string | number; label: string }) {
  return (
    <div className="fact">
      <span className="fact-icon">{icon}</span>
      <b>{v}</b>
      <span>{label}</span>
    </div>
  );
}
