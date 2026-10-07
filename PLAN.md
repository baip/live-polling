# Plan: Mentimeter-style live polling app on Cloudflare Workers

## Decisions (from user)
- MVP interactions: multiple-choice polls, word cloud, quiz with scoring & leaderboard,
  plus end-of-session feedback (v2)
- **Anonymous voting is the most important feature** — no accounts for audience or presenters
- Realtime via HTTP polling (~2s, slower in lobby, paused on hidden tabs) — no WebSockets
- Hosted on Cloudflare free tier: Workers + D1 (SQLite)
- Vote-once-per-user enforced at DB level: composite PK `(question_id, participant_id, seq)`
  (`seq = 0` for single-answer questions; multi-entry word clouds use unique seq values)

## Architecture
Single Workers project: React SPA (Vite + `@cloudflare/vite-plugin`) served as static
assets by the same Worker that exposes the API. Hono for routing. D1 for all state.

### Data model (D1)
- `presentations`: code (PK, 6-char join code), presenter_key (secret), title,
  status (lobby/active/revealing/closed), current_index, question_started_at, created_at
- `questions`: id PK, presentation_code FK, idx, type (mc|wordcloud|quiz), prompt,
  options (JSON), correct_index, time_limit_sec
- `participants`: id (UUID PK), presentation_code FK, nickname, created_at
- `responses`: question_id, participant_id, value, points, answered_at
  — PRIMARY KEY(question_id, participant_id)

### API (Hono, all under /api)
- POST /api/presentations — create with questions → { code, presenterKey }
- POST /api/presentations/import — import an exported JSON definition as a new session
- GET  /api/presentations/:code/export — presentation definition as JSON (presenter only)
- GET  /api/presentations/:code/results.md — full results as Markdown report (presenter only)
- GET  /api/presentations/:code/feedback — raw feedback responses (presenter only)
- POST /api/presentations/:code/join — nickname → { participantId } (localStorage)
- GET  /api/presentations/:code/state — role-aware snapshot (question, my answer,
  aggregates after reveal, leaderboard if enabled, serverTime for countdown sync)
- POST /api/presentations/:code/respond — { participantId, questionId, value } → 201 | 409
  (quiz answers after the time limit are rejected with 409 time_expired)
- POST /api/presentations/:code/control — { presenterKey, action: start|reveal|next|close }

### v2 additions
- Questions have optional title + description; vote counts shown on all results
- MC results hidden from everyone (presenter included) until reveal
- Per-question leaderboard toggle (off by default)
- Word clouds support multi-entry mode
- Quiz: correct answer hidden until reveal; countdown synced to server time

### Quiz scoring
Server-timestamped answers; correct = 500 base + up to 500 speed bonus scaled by
remaining time. Leaderboard = SUM(points) GROUP BY participant.

### Frontend routes (React Router)
- `/` landing (create or join)
- `/create` presentation builder
- `/present/:code` presenter console (QR + join code, controls, live results, leaderboard)
- `/join` → `/play/:code` audience view

## Out of scope
Slide decks/rich content, image uploads, word-cloud moderation, branding, exports.

## Known limits
Workers free tier ≈ 100k req/day; 2s polling ≈ 1,800 req/participant/hour
(~50 participants for a 1-hour session). Mitigated by slower lobby polling and
pausing hidden tabs.
