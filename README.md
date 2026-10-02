# Live Polling

A Mentimeter-style live polling app: anonymous audience voting with multiple-choice
polls, word clouds, and scored quizzes with a leaderboard. Built on Cloudflare
Workers + D1 (SQLite), React SPA frontend, HTTP polling for live updates.

## Prerequisites

- Node.js 20+
- A Cloudflare account (free tier) for deployment — not needed for local dev

## Setup

```bash
npm install
npm run db:migrate:local   # creates the local D1 database
npm run dev                # http://localhost:5173
```

## Usage

1. Open the app, click **Create a presentation**, add questions, and create.
2. You're taken to the presenter console with a QR code and 6-character join code.
   The presenter key is stored in that browser's session storage.
3. Audience members open the join URL (or enter the code), pick a nickname — no
   accounts. Each browser gets an anonymous participant id stored in localStorage.
4. Press **Start session**, then **Reveal answers** / **Next question** to drive
   the flow. Each participant can answer each question exactly once.

## Deploy

```bash
npm run db:create          # prints a database_id — paste it into wrangler.jsonc
npm run db:migrate:remote
npm run deploy
```

## Architecture

- `src/worker/index.ts` — Hono API (create/join/state/respond/control) running in
  the Worker; serves the built SPA via the assets binding.
- `src/client/` — React SPA (Vite). Polls `/api/.../state` every ~2s
  (5s in the lobby, paused while the tab is hidden).
- `src/shared/types.ts` — API payload types shared by both sides.
- `migrations/` — D1 schema. Vote-once is enforced by the composite primary key
  `(question_id, participant_id)` on `responses`.
- Quiz scoring: 500 base points for a correct answer + up to 500 speed bonus,
  computed server-side from the question start timestamp.

See [PLAN.md](PLAN.md) for the design decisions and known limits.
