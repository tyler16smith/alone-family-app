# Alone: Family Edition

A party game based on the survival show *Alone*. The host starts a season at a location, and family members scan a QR code to fill in their bio, items (max 10) and skills. The host taps **Simulate**: Claude scores everyone's survival odds, 1,000 seasons are simulated, and the results screen shows the winner, how the season went and the odds.

## Run locally
```bash
npm install
npm run db:migrate   # creates tables in Neon (safe to re-run)
npm run dev          # http://localhost:5173 (phones on the same Wi-Fi use the QR code)
```

## Live
https://alone-family-app.vercel.app. Phones join at `/join` or by scanning the QR code on the host screen.
The host opens `https://alone-family-app.vercel.app/?host=<HOST_KEY>` once (the key is in `.env.host.local`).

Pushing to `main` deploys to production automatically (the GitHub repo is connected to Vercel). `npm run deploy` still works for a manual deploy.

## Adding the Anthropic key
```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env.local                       # local dev
npx vercel env add ANTHROPIC_API_KEY production                         # paste the key when asked
npm run deploy
```

## Env (`.env.local`)
| Var | Needed | What |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres (written by `neon deploy`) |
| `ANTHROPIC_API_KEY` | recommended | AI scoring + narration. Without it, scoring falls back to keyword matching |
| `HOST_KEY` | for deploys | Protects host actions. Open `/?host=<key>` once on the host device |

## Customize
- **Family roster + preset bios/skills:** kept privately in the database (never in git or public endpoints).
  Put them in `roster.private.json` (gitignored), as `[{ "name": "Mom", "bio": "...", "skills": "..." }]`, then run `npm run roster:load`.
  The list replaces the roster. Each new season copies the roster in, so only people with that season's code can see it.
- **Locations, quick-pick items, item cap:** `shared/data.ts`
- **Simulation tuning:** `server/sim.ts`

## Layout
- `src/`: React app (host screens `/` and `/host/:code`, phone screen `/s/:code`, code entry `/join`)
- `server/`: API routes (`handler.ts`), Claude scoring and narration, and the Monte Carlo simulation
- `api/index.ts`: Vercel function that serves the same handler (`vercel.json` rewrites `/api/*` to it)
