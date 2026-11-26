// Types shared by the server (api/, server/) and the browser (src/).

export type Location = {
  id: string;
  name: string;
  blurb: string;
  cold: number; // 0-10
  wet: number; // 0-10
  foodAbundance: number; // 0-10
  predators: number; // 0-10
  predatorName: string; // "bears", "wolves", "pumas"…
};

export type Player = {
  id: number;
  name: string;
  bio: string;
  skills: string;
  items: string[];
  joined: boolean; // false = seeded from the roster, hasn't scanned in yet
  updatedAt: string;
};

export type RosterPerson = { name: string; bio: string; skills: string };

export type Season = {
  code: string;
  location: Location;
  createdAt: string;
};

export type Scores = {
  shelter: number;
  fire: number;
  food: number;
  fitness: number;
  mental: number;
  injuryRisk: number;
  // 0 = can't survive alone at all (babies, toddlers), 10 = fully capable adult. Missing on older results.
  independence?: number;
  note: string; // one-line justification
};

export type Cause = "starvation" | "exposure" | "injury" | "mental" | "rescued" | "winner";

export type PlayerStats = {
  playerId: number;
  name: string;
  winPct: number;
  avgPlace: number;
  medianDayOut: number;
  topCause: Cause;
  scores: Scores;
};

/** Things that actually happened to this person in the featured simulated season. */
export type SeasonFacts = {
  lbsLost: number;
  mealsCaught: number;
  storms: number; // storms lived through
  predatorScares: number; // days with a predator encounter
};

export type Finish = {
  playerId: number;
  name: string;
  place: number;
  day: number; // day tapped out (winner: final day)
  cause: Cause;
  reason: string;
  headline?: string; // short funny slide title (newer results only)
  facts?: SeasonFacts;
};

export type SimResult = {
  id: number;
  createdAt: string;
  runs: number;
  seed: number;
  scoredBy: "claude" | "keywords";
  stats: PlayerStats[]; // sorted by avgPlace
  survival: { day: number; pctIn: number }[];
  featured: Finish[]; // sorted by place (1 = winner)
  recap: string;
};

export type SeasonState = {
  season: Season;
  players: Player[];
  latest: SimResult | null;
};
