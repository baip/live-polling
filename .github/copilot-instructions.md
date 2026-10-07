# Copilot instructions — live-polling

Mentimeter-style live polling app. React SPA + Hono API in a single Cloudflare
Worker, D1 (SQLite) storage, HTTP polling (~2s) for live updates. Audience is
fully anonymous; presenters log in with a passcode or email PIN.

Read [README.md](../README.md) for the full architecture, data model, auth model,
and API surface — it is the source of truth.

## Commands
- `npm run dev` — dev server on :5173 (needs `npm run db:migrate:local` first,
  and `.dev.vars` for login secrets — see `.dev.vars.example`)
- `npm run build` — typecheck (`tsc -b`) + build
- `npm run deploy` — build + `wrangler deploy`
- `npm run db:migrate:local` / `db:migrate:remote` — D1 migrations
- Smoke tests (dev server must be running): `bash scripts/smoke*.sh`;
  all accept `BASE=` and some need `PASS=`.

## Conventions
- Shared request/response types live in `src/shared/types.ts` — update both sides together.
- Schema changes = new file in `migrations/` (never edit applied ones).
- Vote-once is DB-enforced via PK `(question_id, participant_id, seq)`; don't
  bypass it except multi-entry word clouds (unique `seq`).
- Never expose quiz `correct_index` or result distributions before reveal.
- Secrets (passcode, Resend key, email allowlist) are Worker secrets/env vars,
  never hardcoded. Add new ones to `.dev.vars.example` and the README table.

## Gotchas
- `wrangler d1 migrations apply --remote` does NOT accept `--yes`; run it
  plainly (non-interactive contexts auto-confirm).
- This machine's npm blocks postinstall scripts — `esbuild` and `workerd` are
  approved via the `allowScripts` field in package.json.
- The terminal mangles multi-line heredocs — write test scripts to files
  (`scripts/`) instead of inline `curl` chains.
- Polling pauses on hidden tabs by design (free-tier quota) — browser tests
  need CDP focus emulation or pages look stale.
