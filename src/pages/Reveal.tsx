// Timeline reveal shown right after a simulation: a marker travels from day 0 toward an unknown final day,
// stopping at each tap-out. Space/Enter continues; after the last tap-out it runs to the end and hands off to results.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Cause, Finish, SeasonState, SimResult } from "../../shared/types";

const CAUSE: Record<Cause, string> = {
  winner: "Winner",
  starvation: "Starvation",
  exposure: "Cold & wet",
  injury: "Injury",
  mental: "Missed home",
  rescued: "Needed rescuing",
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

type Label = { f: Finish; x: number; side: -1 | 1; level: number };

export default function Reveal({ result, state, onDone }: { result: SimResult; state: SeasonState; onDone: () => void }) {
  const loc = state.season.location;
  const winner = result.featured[0];
  const endDay = Math.max(winner.day, 1);
  // Tap-outs in the order they happened (last place first); the winner is the destination, not a stop.
  const stops = useMemo(() => [...result.featured].filter((f) => f.place !== 1).sort((a, b) => a.day - b.day || b.place - a.place), [result]);
  // sqrt scale spreads out the early days, when most of the drama happens
  const xOf = useCallback((day: number) => Math.sqrt(Math.max(0, day) / endDay) * 100, [endDay]);

  const [day, setDay] = useState(0); // where the marker is (fractional while moving)
  const [reached, setReached] = useState(0); // how many stops have been revealed
  const [moving, setMoving] = useState(false);
  const [finished, setFinished] = useState(false);
  const anim = useRef<{ raf: number; to: number; done: () => void } | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const exit = useCallback(() => doneRef.current(), []);
  const dayRef = useRef(0);

  const moveTo = useCallback((to: number, done: () => void) => {
    const from = dayRef.current;
    const dist = Math.abs(xOf(to) - xOf(from));
    const ms = Math.min(3200, Math.max(700, 700 + dist * 28));
    const t0 = performance.now();
    setMoving(true);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const d = from + (to - from) * ease(t);
      dayRef.current = d;
      setDay(d);
      if (t < 1) anim.current = { raf: requestAnimationFrame(step), to, done };
      else { anim.current = null; setMoving(false); done(); }
    };
    anim.current = { raf: requestAnimationFrame(step), to, done };
  }, [xOf]);

  // Jump to the end of the current move (pressing Space mid-move).
  const finishMove = useCallback(() => {
    const a = anim.current;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    anim.current = null;
    dayRef.current = a.to;
    setDay(a.to);
    setMoving(false);
    a.done();
  }, []);

  const goToStop = useCallback((i: number) => {
    if (i < stops.length) moveTo(stops[i].day, () => setReached(i + 1));
    else moveTo(endDay, () => { setFinished(true); setTimeout(exit, 1600); });
  }, [stops, endDay, moveTo, exit]);

  // Start moving toward the first tap-out right away (once).
  const goRef = useRef(goToStop);
  goRef.current = goToStop;
  useEffect(() => {
    const t = setTimeout(() => goRef.current(0), 600);
    return () => { clearTimeout(t); if (anim.current) cancelAnimationFrame(anim.current.raf); };
  }, []);

  const advance = useCallback(() => {
    if (finished) return exit();
    if (moving) return finishMove();
    goToStop(reached);
  }, [finished, moving, reached, goToStop, finishMove, exit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ([" ", "Enter", "ArrowRight"].includes(e.key)) { e.preventDefault(); advance(); }
      else if (e.key === "Escape") exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, exit]);

  // Stack labels that would overlap: alternate above/below the line, then step outward.
  const labels: Label[] = useMemo(() => {
    const placed: Label[] = [];
    stops.slice(0, reached).forEach((f, i) => {
      const x = xOf(f.day);
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      let level = 0;
      while (placed.some((p) => p.side === side && p.level === level && Math.abs(p.x - x) < 11)) level++;
      placed.push({ f, x, side, level });
    });
    return placed;
  }, [stops, reached, xOf]);

  const current = reached > 0 && !moving && !finished ? stops[reached - 1] : null;
  const left = stops.length - reached;
  const shownDay = Math.max(0, Math.round(day));

  return (
    <div className="reveal">
      <button className="deck-close" onClick={exit}>Skip ⏭</button>
      <div className="eyebrow">{loc.name} · {result.featured.length} contestants</div>
      <div className="reveal-day">Day <b>{shownDay}</b></div>
      <div className="reveal-sub">{finished ? "One left standing…" : `${result.featured.length - reached} still in`}</div>

      <div className="tl">
        <div className="tl-line" />
        <div className="tl-progress" style={{ width: `${xOf(day)}%` }} />
        <div className="tl-end tl-start">Day 0</div>
        <div className={`tl-end tl-finish ${finished ? "on" : ""}`}>{finished ? `Day ${endDay}` : "?"}</div>

        {labels.map(({ f, x, side, level }) => (
          <div key={f.playerId} className={`tl-stop ${current?.playerId === f.playerId ? "current" : ""}`} style={{ left: `${x}%` }}>
            <span className="tl-dot" />
            <span className="tl-stem" style={{ height: 22 + level * 44, [side < 0 ? "bottom" : "top"]: 0 } as React.CSSProperties} />
            <div
              className={`tl-label ${side < 0 ? "above" : "below"} ${x > 72 ? "edge-right" : x < 18 ? "edge-left" : ""}`}
              style={{ [side < 0 ? "bottom" : "top"]: 22 + level * 44 } as React.CSSProperties}
            >
              <span className="tl-name">{f.name}</span>
              <span className="tl-when">day {f.day}</span>
              <Pop f={f} result={result} predators={loc.predatorName} />
            </div>
          </div>
        ))}

        <div className={`tl-marker ${moving ? "moving" : ""} ${finished ? "done" : ""}`} style={{ left: `${xOf(day)}%` }}>🔥</div>
      </div>

      <div className="reveal-card-slot">
        {current && (
          <div className="reveal-card" key={current.playerId}>
            <div className="eyebrow">Out on day {current.day} · {CAUSE[current.cause]}</div>
            <h2>{current.name}</h2>
            {current.headline && <p className="reveal-headline">“{current.headline}”</p>}
            <p className="reveal-reason">{current.reason}</p>
          </div>
        )}
        {finished && (
          <div className="reveal-card winner-tease" key="end">
            <div className="eyebrow">Day {endDay}</div>
            <h2>And the winner is…</h2>
          </div>
        )}
      </div>

      <div className="reveal-hint">
        {finished ? "" : moving ? "Space to skip ahead" : left > 0 ? <>Press <kbd>Space</kbd> or <kbd>Enter</kbd> · {left} more to go</> : <>Press <kbd>Space</kbd> to find the winner</>}
      </div>
    </div>
  );
}

function Pop({ f, result, predators }: { f: Finish; result: SimResult; predators: string }) {
  const s = result.stats.find((x) => x.playerId === f.playerId);
  return (
    <div className="tl-pop">
      <div className="eyebrow">{f.place === 1 ? "Winner" : `Out on day ${f.day} · ${CAUSE[f.cause]}`}</div>
      <b className="tl-pop-name">{f.name}</b>
      {f.headline && <div className="reveal-headline">“{f.headline}”</div>}
      <p>{f.reason}</p>
      <div className="tl-pop-facts">
        {f.facts && <span>⚖️ {f.facts.lbsLost} lbs lost</span>}
        {f.facts && <span>🐟 {f.facts.mealsCaught} meals</span>}
        {f.facts && <span>⛈️ {f.facts.storms} storms</span>}
        {f.facts && <span>🐾 {f.facts.predatorScares} {predators} run-ins</span>}
        {s && <span>🎲 won {s.winPct}% of seasons</span>}
      </div>
    </div>
  );
}
