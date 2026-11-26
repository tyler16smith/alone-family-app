// Monte Carlo season simulator. Pure functions, no I/O.
import type { Cause, Location, Scores, SeasonFacts } from "../shared/types.js";

export type SimPlayer = { id: number; name: string; scores: Scores };

export type RunFinish = { id: number; place: number; day: number; cause: Cause; facts: SeasonFacts };

export type Aggregate = {
  perPlayer: Map<number, { wins: number; placeSum: number; daysOut: number[]; causes: Record<string, number> }>;
  survival: { day: number; pctIn: number }[];
  featured: RunFinish[];
};

const MAX_DAYS = 150;

// Small seeded PRNG (mulberry32) so a season can be replayed exactly.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Live = { p: SimPlayer; energy: number; start: number; meals: number; storms: number; scares: number };

// Energy points to pounds: a steady baseline loss plus whatever reserves were burned.
const lbs = (l: Live, days: number) => {
  const v = days * 0.35 + Math.max(0, l.start - l.energy) * 0.35;
  return v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
};
const factsOf = (l: Live, days: number): SeasonFacts => ({ lbsLost: lbs(l, days), mealsCaught: l.meals, storms: l.storms, predatorScares: l.scares });

/** One season. Returns finishes ordered by place (1 = winner). */
export function runSeason(players: SimPlayer[], loc: Location, rand: () => number): RunFinish[] {
  const live: Live[] = players.map((p) => { const e = 70 + p.scores.fitness * 3; return { p, energy: e, start: e, meals: 0, storms: 0, scares: 0 }; });
  const out: { id: number; day: number; cause: Cause; energy: number; facts: SeasonFacts }[] = [];
  let storm = 0, bounty = 0, coldSnap = 0;

  let day = 0;
  while (live.length > 1 && day < MAX_DAYS) {
    day++;
    // Location-wide events
    let newStorm = false;
    if (storm > 0) storm--; else if (rand() < 0.03 + loc.wet * 0.003) { storm = 2 + Math.floor(rand() * 3); newStorm = true; }
    if (coldSnap > 0) coldSnap--; else if (day > 20 && rand() < 0.01 + loc.cold * 0.002) coldSnap = 3 + Math.floor(rand() * 4);
    if (bounty > 0) bounty--; else if (rand() < 0.02) bounty = 4;
    const predatorDay = rand() < 0.01 + loc.predators * 0.003;
    // Season gets colder as it goes
    const cold = Math.min(10, loc.cold + day / 40 + (coldSnap ? 2 : 0));

    const leaving: { l: Live; cause: Cause }[] = [];
    for (const l of live) {
      const s = l.p.scores;
      if (newStorm) l.storms++;
      if (predatorDay) l.scares++;
      const warmth = (s.shelter + s.fire) / 2; // 0-10
      // Calories
      const drain = Math.max(0.5, 1.2 + day * 0.008 + cold * 0.12 + (storm ? 0.6 : 0) - warmth * 0.06);
      const catchChance = Math.min(0.9, (0.04 + s.food * 0.045) * (0.4 + loc.foodAbundance / 10) * (bounty ? 1.8 : 1) * (storm ? 0.5 : 1));
      const gain = rand() < catchChance ? 2 + rand() * 6 : 0;
      if (gain) l.meals++;
      l.energy = Math.min(100, l.energy - drain + gain);

      // Can't function alone (toddlers, someone on a walker): near-certain pull in the first day or two.
      const indep = s.independence ?? 10;
      const hazards: [Cause, number][] = [
        ["rescued", indep < 5 ? ((5 - indep) / 5) ** 2 * 0.97 : 0],
        ["starvation", l.energy < 40 ? ((40 - l.energy) / 40) ** 2 * 0.15 * (1.25 - s.mental * 0.04) : 0],
        ["exposure", Math.max(0, (cold + loc.wet) / 2 - warmth) * 0.0025 * (storm ? 3 : 1)],
        ["injury", (0.0006 + s.injuryRisk * 0.0005) * (predatorDay ? 1 + loc.predators * 0.6 : 1)],
        // early homesickness for the unprepared, then slow-building loneliness
        ["mental", (day <= 10 ? 0.025 * Math.max(0, 0.8 - s.mental / 10) : 0) + (day / 100) * 0.01 * Math.max(0.1, 1.1 - s.mental / 10)],
      ];
      for (const [cause, p] of hazards) {
        if (p > 0 && rand() < p) { leaving.push({ l, cause }); break; }
      }
    }
    // Never eliminate everyone on the same day: the strongest stays.
    if (leaving.length >= live.length) {
      leaving.sort((a, b) => b.l.energy - a.l.energy);
      leaving.shift();
    }
    for (const { l, cause } of leaving) {
      out.push({ id: l.p.id, day, cause, energy: l.energy, facts: factsOf(l, day) });
      live.splice(live.indexOf(l), 1);
    }
  }
  // Anyone left at the end: rank by energy; top one is the winner.
  live.sort((a, b) => b.energy - a.energy);
  const finishes: RunFinish[] = [];
  live.forEach((l, i) => finishes.push({ id: l.p.id, place: i + 1, day, cause: i === 0 ? "winner" : "starvation", facts: factsOf(l, day) }));
  out.sort((a, b) => b.day - a.day || b.energy - a.energy);
  out.forEach((o) => finishes.push({ id: o.id, place: finishes.length + 1, day: o.day, cause: o.cause, facts: o.facts }));
  return finishes;
}

/** Run many seasons and aggregate. */
export function simulate(players: SimPlayer[], loc: Location, runs: number, seed: number): Aggregate {
  const rand = rng(seed);
  const perPlayer: Aggregate["perPlayer"] = new Map(
    players.map((p) => [p.id, { wins: 0, placeSum: 0, daysOut: [], causes: {} }]),
  );
  const inByDay = new Array(MAX_DAYS + 1).fill(0);
  const all: RunFinish[][] = [];

  for (let r = 0; r < runs; r++) {
    const f = runSeason(players, loc, rand);
    all.push(f);
    for (const x of f) {
      const a = perPlayer.get(x.id)!;
      if (x.place === 1) a.wins++;
      a.placeSum += x.place;
      a.daysOut.push(x.day);
      a.causes[x.cause] = (a.causes[x.cause] ?? 0) + 1;
      for (let d = 0; d < Math.min(x.day, MAX_DAYS + 1); d++) inByDay[d]++;
    }
  }

  const lastDay = Math.max(...all.map((f) => f[0].day));
  const survival = [];
  for (let d = 0; d <= lastDay; d++) {
    survival.push({ day: d, pctIn: Math.round((inByDay[d] / (runs * players.length)) * 1000) / 10 });
  }

  // Featured season: the run whose finishing order is closest to the consensus (average place).
  const consensus = new Map(
    [...perPlayer.entries()].sort((a, b) => a[1].placeSum - b[1].placeSum).map(([id], i) => [id, i + 1]),
  );
  let best = all[0], bestDist = Infinity;
  for (const f of all) {
    const dist = f.reduce((s, x) => s + Math.abs(x.place - consensus.get(x.id)!), 0);
    if (dist < bestDist) { best = f; bestDist = dist; }
  }
  return { perPlayer, survival, featured: best };
}

export function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}
