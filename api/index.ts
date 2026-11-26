// Vercel serverless function: every /api/* request lands here.
import type { IncomingMessage, ServerResponse } from "node:http";
import { nodeHandler } from "../server/node.js";

export const config = { maxDuration: 60 };

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return nodeHandler(req, res);
}
