// All API routes, framework-free. Used by the Vercel function (api/) and the Vite dev server.
import { networkInterfaces } from "node:os";
import { sql } from "./db.js";
import { simulate, median } from "./sim.js";
import { scoreHash, scoreWithClaude, scoreWithKeywords } from "./score.js";
import { narrate, templateReason } from "./narrate.js";
import { resolveLocation } from "./location.js";
import { LOCATIONS, MAX_ITEMS, MAX_TEXT } from "../shared/data.js";
import { getRoster, seedSeason, setRoster } from "./roster.js";
import type { Cause, Finish, Location, Player, PlayerStats, Scores, Season, SeasonState, SimResult } from "../shared/types.js";

type Req = { method: string; path: string; body: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: number; json: unknown };

class HttpError extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

const ok = (json: unknown): Res => ({ status: 200, json });
type Row = Record<string, any>;
const q = async (text: string, params: unknown[] = []) => (await sql().query(text, params)) as Row[];

function requireHost(req: Req) {
  const key = process.env.HOST_KEY;
  if (key && req.headers["x-host-key"] !== key) throw new HttpError(401, "Host key required");
}

const toPlayer = (r: Row): Player => ({
  id: r.id, name: r.name, bio: r.bio, skills: r.skills, items: r.items, joined: r.joined, updatedAt: new Date(r.updated_at).toISOString(),
});

async function getSeasonRow(code: string) {
  const [s] = await q("SELECT * FROM seasons WHERE code = $1", [code.toUpperCase()]);
  if (!s) throw new HttpError(404, "No season with that code");
  return s;
}

async function seasonState(code: string): Promise<SeasonState> {
  const s = await getSeasonRow(code);
  const players = (await q("SELECT * FROM players WHERE season_id = $1 ORDER BY name", [s.id])).map(toPlayer);
  const [sim] = await q("SELECT * FROM simulations WHERE season_id = $1 ORDER BY id DESC LIMIT 1", [s.id]);
  const season: Season = { code: s.code, location: s.location, createdAt: new Date(s.created_at).toISOString() };
  return { season, players, latest: sim ? { ...sim.results, id: sim.id, createdAt: new Date(sim.created_at).toISOString() } : null };
}

function newCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O to avoid confusion
  return Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join("");
}

function cleanText(v: unknown) {
  return String(v ?? "").slice(0, MAX_TEXT);
}

function cleanItems(v: unknown) {
  const arr = Array.isArray(v) ? v : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const s = String(x).trim().slice(0, 60);
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  }
  return out.slice(0, MAX_ITEMS);
}

// ---------- scoring + simulation ----------

async function getScores(players: Player[], loc: Location): Promise<{ scores: Map<number, Scores>; by: "claude" | "keywords" }> {
  const hashes = new Map(players.map((p) => [p.id, scoreHash(p, loc)]));
  const cached = await q("SELECT hash, scores FROM score_cache WHERE hash = ANY($1)", [[...hashes.values()]]);
  const byHash = new Map(cached.map((r) => [r.hash, r.scores as Scores]));
  const scores = new Map<number, Scores>();
  const missing: Player[] = [];
  for (const p of players) {
    const hit = byHash.get(hashes.get(p.id)!);
    if (hit) scores.set(p.id, hit); else missing.push(p);
  }
  let by: "claude" | "keywords" = "claude";
  if (missing.length) {
    let fresh: Map<number, Scores> | null = null;
    if (process.env.ANTHROPIC_API_KEY) {
      try { fresh = await scoreWithClaude(missing, loc); } catch (e) { console.error("Claude scoring failed, using keywords:", e); }
    }
    for (const p of missing) {
      const s = fresh?.get(p.id);
      if (s) {
        scores.set(p.id, s);
        await q("INSERT INTO score_cache (hash, scores) VALUES ($1, $2) ON CONFLICT (hash) DO UPDATE SET scores = $2", [hashes.get(p.id), JSON.stringify(s)]);
      } else {
        scores.set(p.id, scoreWithKeywords(p)); // not cached, so a later run with a key re-scores
        by = "keywords";
      }
    }
  }
  return { scores, by };
}

async function runSimulation(code: string): Promise<SimResult> {
  const s = await getSeasonRow(code);
  const loc: Location = s.location;
  const players = (await q("SELECT * FROM players WHERE season_id = $1 AND joined", [s.id])).map(toPlayer);
  if (players.length < 2) throw new HttpError(400, "Need at least 2 people joined to simulate");

  const { scores, by } = await getScores(players, loc);
  const runs = 1000;
  const seed = Math.floor(Math.random() * 2 ** 31);
  const agg = simulate(players.map((p) => ({ id: p.id, name: p.name, scores: scores.get(p.id)! })), loc, runs, seed);

  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const stats: PlayerStats[] = players
    .map((p) => {
      const a = agg.perPlayer.get(p.id)!;
      const topCause = (Object.entries(a.causes).filter(([c]) => c !== "winner").sort((x, y) => y[1] - x[1])[0]?.[0] ?? "winner") as Cause;
      return {
        playerId: p.id, name: p.name,
        winPct: Math.round((a.wins / runs) * 1000) / 10,
        avgPlace: Math.round((a.placeSum / runs) * 10) / 10,
        medianDayOut: median(a.daysOut),
        topCause, scores: scores.get(p.id)!,
      };
    })
    .sort((x, y) => x.avgPlace - y.avgPlace);

  const featured: Finish[] = agg.featured.map((f) => ({
    playerId: f.id, name: nameOf.get(f.id)!, place: f.place, day: f.day, cause: f.cause,
    reason: templateReason(f.cause, f.day, nameOf.get(f.id)!, loc),
  }));
  const w = featured[0];
  let recap = `${w.name} won ${loc.name} after ${w.day} days. ${featured[featured.length - 1].name} was first to leave, on day ${featured[featured.length - 1].day}.`;
  if (by === "claude" && process.env.ANTHROPIC_API_KEY) {
    try {
      const n = await narrate(featured, players, loc);
      recap = n.recap;
      for (const r of n.reasons) {
        const f = featured.find((x) => x.playerId === r.playerId);
        if (f && r.reason) f.reason = r.reason;
      }
    } catch (e) { console.error("Narration failed, using templates:", e); }
  }

  const results = { runs, seed, scoredBy: by, stats, survival: agg.survival, featured, recap };
  const [row] = await q("INSERT INTO simulations (season_id, seed, results) VALUES ($1, $2, $3) RETURNING id, created_at", [s.id, seed, JSON.stringify(results)]);
  return { ...results, id: row.id, createdAt: new Date(row.created_at).toISOString() };
}

// In local dev, phones can't open "localhost": hand the host page this machine's Wi-Fi address instead.
function lanOrigin(req: Req): string | null {
  if (process.env.VERCEL) return null;
  const host = String(req.headers.host ?? "");
  if (!/^(localhost|127\.0\.0\.1)(:|$)/.test(host)) return null;
  const port = host.split(":")[1];
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family === "IPv4" && !i.internal) return `http://${i.address}${port ? `:${port}` : ""}`;
    }
  }
  return null;
}

// ---------- router ----------

export async function handle(req: Req): Promise<Res> {
  try {
    const parts = req.path.replace(/^\/api\/?/, "").split("/").filter(Boolean);
    const [a, b, c] = parts;
    const m = req.method;

    if (m === "GET" && a === "health") {
      const [r] = await q("SELECT now() AS now, (SELECT count(*) FROM seasons)::int AS seasons");
      return ok({ ok: true, db: r, ai: !!process.env.ANTHROPIC_API_KEY, hostKey: !!process.env.HOST_KEY });
    }
    if (m === "GET" && a === "meta") return ok({ locations: LOCATIONS, lanOrigin: lanOrigin(req) });
    if (m === "GET" && a === "host-check") { requireHost(req); return ok({ ok: true }); }

    if (a === "roster" && !b) {
      requireHost(req);
      if (m === "GET") return ok(await getRoster());
      if (m === "PUT") {
        try { return ok(await setRoster(req.body)); } catch (e) { throw new HttpError(400, (e as Error).message); }
      }
    }

    if (a === "seasons" && !b && m === "POST") {
      requireHost(req);
      const loc = await resolveLocation(req.body);
      if (!loc) throw new HttpError(400, "Unknown location");
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const [row] = await q("INSERT INTO seasons (code, location) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING RETURNING id, code", [code, JSON.stringify(loc)]);
        if (row) { await seedSeason(row.id); return ok({ code }); }
      }
      throw new HttpError(500, "Could not allocate a code");
    }

    if (a === "seasons" && b) {
      if (m === "GET" && !c) return ok(await seasonState(b));

      if (m === "DELETE" && !c) {
        requireHost(req);
        await q("DELETE FROM seasons WHERE code = $1", [b.toUpperCase()]);
        return ok({ ok: true });
      }

      if (m === "PUT" && c === "location") {
        requireHost(req);
        const loc = await resolveLocation(req.body);
        if (!loc) throw new HttpError(400, "Unknown location");
        await q("UPDATE seasons SET location = $2 WHERE code = $1", [b.toUpperCase(), JSON.stringify(loc)]);
        return ok(await seasonState(b));
      }

      if (m === "POST" && c === "join") {
        const s = await getSeasonRow(b);
        const name = String(req.body?.name ?? "").trim().slice(0, 40);
        if (!name) throw new HttpError(400, "Name required");
        const [existing] = await q("SELECT * FROM players WHERE season_id = $1 AND lower(name) = lower($2)", [s.id, name]);
        if (existing) {
          // Roster people were pre-created for this season; scanning in marks them as joined.
          if (!existing.joined) { await q("UPDATE players SET joined = true WHERE id = $1", [existing.id]); existing.joined = true; }
          return ok(toPlayer(existing));
        }
        // Someone not on the roster starts blank (no lookups across seasons, so nobody can pull another season's bios).
        const [row] = await q("INSERT INTO players (season_id, name) VALUES ($1, $2) RETURNING *", [s.id, name]);
        return ok(toPlayer(row));
      }

      if (m === "POST" && c === "simulate") { requireHost(req); return ok(await runSimulation(b)); }
    }

    if (a === "players" && b) {
      const id = Number(b);
      if (m === "PUT") {
        const [row] = await q(
          "UPDATE players SET bio = $2, skills = $3, items = $4, joined = true, updated_at = now() WHERE id = $1 RETURNING *",
          [id, cleanText(req.body?.bio), cleanText(req.body?.skills), JSON.stringify(cleanItems(req.body?.items))],
        );
        if (!row) throw new HttpError(404, "Player not found");
        return ok(toPlayer(row));
      }
      if (m === "DELETE") { requireHost(req); await q("DELETE FROM players WHERE id = $1", [id]); return ok({ ok: true }); }
    }

    throw new HttpError(404, `No route for ${m} ${req.path}`);
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, json: { error: e.message } };
    console.error(e);
    return { status: 500, json: { error: e instanceof Error ? e.message : "Server error" } };
  }
}
