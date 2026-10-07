# Live Polling

A Mentimeter-style live polling app: anonymous audience voting with multiple-choice
polls, word clouds, scored quizzes, and end-of-session feedback. Built on Cloudflare
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

## Features

- **Multiple-choice polls** — results hidden from everyone until the presenter
  clicks Reveal, which also unlocks them on voters' devices
- **Word clouds** — optional multi-entry mode (participants can keep adding words)
- **Quizzes** — server-enforced time limit with a synced countdown on voters'
  screens; correct answers stay hidden until reveal (even from the presenter);
  500 base points + up to 500 speed bonus
- **Feedback** — free-text responses collected at the end of a session, visible
  live to the presenter
- **Per-question leaderboard toggle** — off by default
- **Export/import** — presenters can download the presentation definition as JSON
  and re-import it as a new session, and download full results as a Markdown report
- Questions support an optional **title** and **description** in addition to the prompt

## Access control

Presenter routes are guarded by two independent layers — either alone is sufficient,
together they provide defense in depth:

### 1. Presenter passcode (in-app)

When the `PRESENTER_PASSCODE` secret is set, creating or importing a presentation
requires it. Audience join/play routes are unaffected — voting stays anonymous.

```bash
# Local dev: put PRESENTER_PASSCODE=... in .dev.vars (see .dev.vars.example)
# Production:
npx wrangler secret put PRESENTER_PASSCODE
```

Without the secret, creation is open (useful for local development).

### 2. Cloudflare Access (edge, email allowlist) — recommended for production

Enforce an email allowlist before requests even reach the Worker:

1. In the Cloudflare dashboard, go to **Zero Trust → Access → Applications → Add**
   and choose **Self-hosted**.
2. Application domain: your hostname (e.g. `live-polling.bai.group`) or the
   workers.dev URL; add **paths** `create`, `present*` — or protect the whole
   domain and rely on session duration for the audience (simplest).
3. Policy: **Allow** → **Emails** → list the allowed presenter addresses.
4. Pick a login method (one-time email PIN works with zero setup; Google/GitHub
   IdPs also work).

The audience routes (`/join`, `/play`, `/api/presentations/*/join`, `/state`,
`/respond`) stay open if you scope Access to the presenter paths. The Worker
never sees unauthenticated presenter requests — Access rejects them at the edge.

## Usage

1. Open the app, click **Create a presentation** (or import an exported JSON file),
   add questions, and create.
2. You're taken to the presenter console with a QR code and 6-character join code.
   The presenter key is stored in that browser's session storage.
3. Audience members open the join URL (or enter the code), pick a nickname — no
   accounts. Each browser gets an anonymous participant id stored in localStorage.
4. Press **Start session**, then **Reveal answers** / **Next question** to drive
   the flow. Each participant can answer each question exactly once (except
   multi-entry word clouds).

## Deploy

```bash
npm run db:create          # prints a database_id — paste it into wrangler.jsonc
npm run db:migrate:remote
npm run deploy
```

## Architecture

- `src/worker/index.ts` — Hono API (create/import/export/results/join/state/
  respond/control/feedback) running in the Worker; serves the built SPA via the
  assets binding.
- `src/client/` — React SPA (Vite). Polls `/api/.../state` every ~2s
  (5s in the lobby, paused while the tab is hidden). Quiz countdowns are synced
  to server time to avoid clock skew.
- `src/shared/types.ts` — API payload types shared by both sides.
- `migrations/` — D1 schema. Vote-once is enforced by the composite primary key
  `(question_id, participant_id, seq)` on `responses` (`seq` is 0 for
  single-answer questions; multi-entry word clouds use unique seq values).
- Quiz scoring: 500 base points for a correct answer + up to 500 speed bonus,
  computed server-side from the question start timestamp; answers after the time
  limit (+2s grace) are rejected with `409 time_expired`.

## Tests

With the dev server running:

```bash
bash scripts/smoke.sh            # core flow: create/join/vote-once/reveal/close
bash scripts/smoke-quiz.sh       # quiz scoring and reveal gating
bash scripts/smoke-wordcloud.sh  # wordcloud normalization
bash scripts/smoke-v2.sh         # v2: titles, leaderboard toggle, hidden results,
                                 #     multi-entry, quiz timer, feedback, export/import
```

All scripts accept `BASE=<url>` to run against production.

See [PLAN.md](PLAN.md) for the design decisions and known limits.
