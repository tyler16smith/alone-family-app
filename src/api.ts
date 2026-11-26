import type { Location, Player, SeasonState, SimResult } from "../shared/types";

const HOST_KEY = "alone.hostKey";

export function hostKey() {
  return localStorage.getItem(HOST_KEY) ?? "";
}
export function setHostKey(k: string) {
  localStorage.setItem(HOST_KEY, k);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-host-key": hostKey() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export type Meta = { locations: Location[]; lanOrigin: string | null };

export type LocationPick = { locationId: string } | { customName: string };

export const api = {
  meta: () => call<Meta>("GET", "/meta"),
  hostCheck: () => call<{ ok: true }>("GET", "/host-check"),
  createSeason: (loc: LocationPick) => call<{ code: string }>("POST", "/seasons", loc),
  season: (code: string) => call<SeasonState>("GET", `/seasons/${code}`),
  setLocation: (code: string, loc: LocationPick) => call<SeasonState>("PUT", `/seasons/${code}/location`, loc),
  join: (code: string, name: string) => call<Player>("POST", `/seasons/${code}/join`, { name }),
  savePlayer: (p: Pick<Player, "id" | "bio" | "skills" | "items">) => call<Player>("PUT", `/players/${p.id}`, p),
  removePlayer: (id: number) => call<{ ok: true }>("DELETE", `/players/${id}`),
  simulate: (code: string) => call<SimResult>("POST", `/seasons/${code}/simulate`),
  deleteSeason: (code: string) => call<{ ok: true }>("DELETE", `/seasons/${code}`),
};
