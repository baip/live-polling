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

**Presenter**: open the app → **Presenter login** → passcode or email PIN → build
questions (or import an exported JSON) → **Create presentation**. You're taken to the
presenter console with a QR code and 6-character join code; the presenter key is
stored in that browser's session storage.

**Audience**: open the join URL (or enter the code) → pick a nickname → answer.
No accounts; each browser gets an anonymous participant id in localStorage.

Drive the session with **Start session → Reveal answers → Next question**.
Each participant answers each question once (except multi-entry word clouds).

## Deploy

```bash
npm run db:create          # prints a database_id — paste it into wrangler.jsonc
npm run db:migrate:remote
npm run deploy
```

## Architecture

- `src/worker/index.ts` — Hono API running in the Worker; serves the built SPA via
  the assets binding. All routes under `/api`.
- `src/client/` — React SPA (Vite). Polls `/api/.../state` every ~2s
  (5s in the lobby, paused while the tab is hidden). Quiz countdowns are synced
  to server time to avoid clock skew.
- `src/shared/types.ts` — API payload types shared by both sides.

### Auth model

Two independent identities, both anonymous-friendly:
- **Presenter**: logs in via passcode or email PIN → 12-hour session token
  (`presenter_sessions` table) required to create/import presentations. The token
  is stored in browser localStorage (`presenter-token`). Per-presentation control
  additionally uses a per-session `presenter_key` (sessionStorage), so a logged-in
  presenter only controls sessions they created.
- **Audience**: joins with a nickname → server-issued UUID (`participants` table)
  stored in localStorage (`participant:CODE`). No login.

### Data model (D1)

- `presentations`: code (PK, 6-char join code), presenter_key, title,
  status (lobby/active/revealing/closed), current_index, question_started_at
- `questions`: type (mc|wordcloud|quiz|feedback), prompt, title, description,
  options (JSON), correct_index, time_limit_sec, show_leaderboard, allow_multiple,
  image (data URL, quiz only)
- `participants`: id (UUID), presentation_code, nickname
- `responses`: value, points, answered_at — PK `(question_id, participant_id, seq)`;
  `seq = 0` for single-answer (enforces vote-once), unique seq for multi-entry
  word clouds
- `presenter_sessions`: token (PK), identity, expires_at (12h TTL)
- `email_login_codes`: email (PK), code_hash (SHA-256), expires_at (10min), attempts
- `passcode_attempts`: ip (PK), failures, locked_until (5 fails → 5min lockout)

### API surface

- `POST /api/auth/passcode` / `POST /api/auth/email` / `POST /api/auth/verify` — presenter login
- `GET  /api/config` — which login methods are enabled
- `POST /api/presentations` / `POST /api/presentations/import` — create (requires presenter token)
- `GET  /api/presentations/:code/export` / `results.md` / `feedback` — presenter-only (key in query)
- `POST /api/presentations/:code/join` / `respond` / `control`; `GET .../state`

### Key behaviors

- Results (vote distribution, word frequencies, quiz correct answer) are hidden
  from everyone until the presenter reveals; the running vote count and options
  are always visible. Feedback responses never appear in state — presenter panel
  and Markdown export only.
- Quiz scoring: 500 base + up to 500 speed bonus, computed server-side from the
  question start timestamp; answers after the time limit (+2s grace) → `409 time_expired`.
- Export/import uses a `live-polling/v1` JSON format; results export is Markdown.
  Downloads use fetch→blob→object URL (see `src/client/download.ts`).

## Tests

With the dev server running:

```bash
bash scripts/smoke.sh            # core flow: create/join/vote-once/reveal/close
bash scripts/smoke-quiz.sh       # quiz scoring and reveal gating
bash scripts/smoke-wordcloud.sh  # wordcloud normalization
bash scripts/smoke-v2.sh         # titles, leaderboard toggle, hidden results,
                                 # multi-entry, quiz timer, feedback, export/import
bash scripts/smoke-v3.sh         # rate limit, live vote counts, quiz image,
                                 # hidden feedback, export content types
bash scripts/smoke-auth.sh       # presenter login: passcode + email PIN + token gating
```

All scripts accept `BASE=<url>` (default `http://localhost:5173`) and some need
`PASS=<passcode>` (default `dev-passcode`). v3's rate-limit test locks the local
test IP, then clears it via a local D1 query — it skips that step against prod.
