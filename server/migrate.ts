// Create tables. Run with: npm run db:migrate
import { sql, SCHEMA } from "./db.js";

for (const stmt of SCHEMA) await sql().query(stmt);
console.log(`Schema ready (${SCHEMA.length} statements applied).`);
