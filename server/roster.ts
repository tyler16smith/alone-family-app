// The private family roster: presets copied into every new season.
import { MAX_TEXT } from "../shared/data.js";
import type { RosterPerson } from "../shared/types.js";
import { sql } from "./db.js";

type Row = Record<string, any>;
const q = async (text: string, params: unknown[] = []) => (await sql().query(text, params)) as Row[];

export async function getRoster(): Promise<RosterPerson[]> {
  const rows = await q("SELECT name, bio, skills FROM roster ORDER BY sort, name");
  return rows.map((r) => ({ name: r.name, bio: r.bio, skills: r.skills }));
}

/** Replace the roster with this list: updates people by name, adds new ones, removes anyone not listed. */
export async function setRoster(input: unknown): Promise<RosterPerson[]> {
  if (!Array.isArray(input)) throw new Error("Expected a list of people");
  const people: RosterPerson[] = [];
  const seen = new Set<string>();
  for (const x of input) {
    const name = String(x?.name ?? "").trim().slice(0, 40);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    people.push({ name, bio: String(x?.bio ?? "").trim().slice(0, MAX_TEXT), skills: String(x?.skills ?? "").trim().slice(0, MAX_TEXT) });
  }
  for (const [i, p] of people.entries()) {
    await q(
      `INSERT INTO roster (name, bio, skills, sort) VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(name)) DO UPDATE SET name = $1, bio = $2, skills = $3, sort = $4,
         updated_at = CASE WHEN roster.bio IS DISTINCT FROM $2 OR roster.skills IS DISTINCT FROM $3 THEN now() ELSE roster.updated_at END`,
      [p.name, p.bio, p.skills, i],
    );
  }
  await q("DELETE FROM roster WHERE NOT (lower(name) = ANY($1))", [people.map((p) => p.name.toLowerCase())]);
  return getRoster();
}

/**
 * Copy the roster into a new season as not-yet-joined players. Each person starts from whichever is newer:
 * their roster preset, or what they saved the last time they played.
 */
export async function seedSeason(seasonId: number) {
  await q(
    `INSERT INTO players (season_id, name, bio, skills, items, joined, roster_id)
     SELECT $1, r.name,
       CASE WHEN prev.updated_at > r.updated_at THEN prev.bio ELSE r.bio END,
       CASE WHEN prev.updated_at > r.updated_at THEN prev.skills ELSE r.skills END,
       COALESCE(prev.items, '[]'::jsonb), false, r.id
     FROM roster r
     LEFT JOIN LATERAL (
       SELECT bio, skills, items, updated_at FROM players p
       WHERE p.roster_id = r.id AND p.joined ORDER BY p.updated_at DESC LIMIT 1
     ) prev ON true
     ON CONFLICT (season_id, name) DO NOTHING`,
    [seasonId],
  );
}
