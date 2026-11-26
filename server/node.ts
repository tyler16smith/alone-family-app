// Adapter from Node's http req/res to the framework-free handler.
import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "./handler.js";

async function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) return req.body; // Vercel already parsed it
  const chunks: Buffer[] = [];
  for await (const ch of req) chunks.push(ch as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

export async function nodeHandler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  // On Vercel, /api/* is rewritten to the single /api function with the original path in ?__path=
  const rewritten = url.searchParams.get("__path");
  const path = rewritten !== null ? `/api/${rewritten}` : url.pathname;
  const body = req.method === "GET" ? undefined : await readBody(req);
  const out = await handle({ method: req.method ?? "GET", path, body, headers: req.headers });
  res.statusCode = out.status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(out.json));
}
