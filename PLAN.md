# Plan (historical)

This file captured the original design decisions. The app has since evolved —
**see [README.md](README.md) for current architecture, auth model, and API.**

Original decisions that still hold:
- Anonymous voting is the core feature — no audience accounts, ever
- HTTP polling instead of WebSockets (no Durable Objects; plain Worker + D1)
- Vote-once enforced at the database level
- Presenter identity started as a secret URL key; login (passcode / email PIN)
  was layered on top later — see README § Access control

Known limit that still holds: Workers free tier ≈ 100k req/day; 2s polling
≈ 1,800 req/participant/hour (~50 participants for a 1-hour session). Mitigated
by 5s lobby polling and pausing hidden tabs.
