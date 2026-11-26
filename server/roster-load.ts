// Load the private family roster from a local JSON file (kept out of git).
// Usage: npm run roster:load [-- path/to/roster.private.json]
// File format: [{ "name": "Mom", "bio": "...", "skills": "..." }, ...]
import { readFileSync } from "node:fs";
import { setRoster } from "./roster.js";

const file = process.argv[2] ?? "roster.private.json";
const people = await setRoster(JSON.parse(readFileSync(file, "utf8")));
console.log(`Roster now has ${people.length} people: ${people.map((p) => p.name).join(", ")}`);
