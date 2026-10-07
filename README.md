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

Presenter routes (`/login`, `/create`, `/present`) are gated. A presenter logs in with
**either** method — both issue a 12-hour session token stored in the browser:

### 1. Passcode

Set the `PRESENTER_PASSCODE` secret; presenters enter it on the login page.
Failed attempts are rate-limited per IP (5 tries → 5-minute lockout).

```bash
# Local dev: put PRESENTER_PASSCODE=... in .dev.vars (see .dev.vars.example)
# Production:
npx wrangler secret put PRESENTER_PASSCODE
```

### 2. Email PIN (allowlist)

Presenters enter their email on the login page; if it's on the allowlist, a 6-digit
code is sent via [Resend](https://resend.com). Codes expire after 10 minutes and 5
wrong attempts. Configure with:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM         # e.g. "Live Polling <polls@p.bai.group>"
npx wrangler secret put PRESENTER_EMAILS   # e.g. "pengbai@umass.edu, dandan@umass.edu"
```

`PRESENTER_EMAILS` is a comma-separated allowlist; update it anytime without touching
code.

For local dev, copy `.dev.vars.example` to `.dev.vars` and fill in values.
Without any secrets, creation is open (convenient for development).

The audience never logs in — join/play/respond routes stay open and anonymous.

### Optional: Cloudflare Access (edge layer)

For an additional edge-level gate in front of `/create` and `/present*` pages,
configure a self-hosted application in **Zero Trust → Access** with an email
allowlist policy (see Cloudflare docs). This is independent of the in-app login.

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
