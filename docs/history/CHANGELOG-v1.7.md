# v1.7 — Cloud completion RPC foundation

- Added `cloud/completion-rpc.sql`: authenticated, row-level protected, append-only completion awards; database uniqueness and transactional insert, server-calculated mission/quest XP, and server time-zone week checks.
- Added `cloud/completion-sync.mjs`: client-side Supabase RPC adapter with silent duplicate reconciliation and retry-safe pending events.
- Added eight adapter tests, including a two-device simulation. Run `npm test`.

## Setup (not yet deployed)
1. Create a Supabase project and run `cloud/schema.sql`, then `cloud/completion-rpc.sql` in SQL editor.
2. Ensure artist_profiles.state.accountTimeZone is a valid IANA time zone.
3. Initialize Supabase JS with an authenticated user session; call `syncCompletions(supabase, xpLedger)` and persist its returned `events` atomically.
4. Recompute visible XP from the reconciled ledger, rather than retaining the prior incremental `totalXp` value. A UI wiring step is still required.

## Security and production gaps
- No live Supabase/PostgreSQL instance was used in these tests; SQL migration and actual concurrent database behavior remain unverified.
- Current RPC is a foundation, NOT final production authorization: it does not validate server-assigned rotating quests, proof upload, active prestige cycle, or a historical immutable time-zone/week assignment. These must be enforced server-side before deployment. Current week-key validation trusts a locally recorded completion timestamp (the agreed honor-based offline policy).
- The standalone UI is not yet wired to call this adapter automatically. It still shows cloud disconnected. Existing browser state stores incremental XP, so duplicate rollback is not yet reflected in its display.
- The simulation tests the adapter's behavior with a fake atomic server; it does not substitute for real concurrent SQL integration tests.
