import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

/** Neon HTTP driver: one request per query, ideal for serverless functions. */
export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    location JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (season_id, name)
  )`,
  // Private family roster: only readable with the host key; copied into each new season.
  `CREATE TABLE IF NOT EXISTS roster (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '',
    sort INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS roster_name_key ON roster (lower(name))`,
  // joined = false: seeded from the roster but hasn't scanned in yet. roster_id links seasons to the same person.
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS joined BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS roster_id INT REFERENCES roster(id) ON DELETE SET NULL`,
  `CREATE TABLE IF NOT EXISTS score_cache (
    hash TEXT PRIMARY KEY,
    scores JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS simulations (
    id SERIAL PRIMARY KEY,
    season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    seed BIGINT NOT NULL,
    results JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];
