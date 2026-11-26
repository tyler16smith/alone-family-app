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
  updatedAt: string;
};

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
  note: string; // one-line justification
};

export type Cause = "starvation" | "exposure" | "injury" | "mental" | "winner";

export type PlayerStats = {
  playerId: number;
  name: string;
  winPct: number;
  avgPlace: number;
  medianDayOut: number;
  topCause: Cause;
  scores: Scores;
};

export type Finish = {
  playerId: number;
  name: string;
  place: number;
  day: number; // day tapped out (winner: final day)
  cause: Cause;
  reason: string;
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
