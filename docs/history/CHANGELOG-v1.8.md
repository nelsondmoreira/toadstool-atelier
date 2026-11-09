# Pocket Art Helper v1.8 — connected completion sync foundation

## Changes
- Auth session now initializes an account-authenticated completion sync bridge.
- Completion sync retries pending events when online and fetches authoritative award rows from Supabase.
- Local optimistic XP is reconciled with the server award snapshot without an extra XP notification.
- Fixed weekly quest event slot mismatch: client now sends `weekly`, matching SQL validation.
- Fixed critical duplicate semantics: an award already present on the server is **confirmed**, not rejected. A second device must still display the one earned award, not zero.
- Synchronization response is guarded against stale sign-in sessions and changes made while requests are in flight.
- Added tests for duplicate acknowledgements, simulated concurrent submissions, snapshot overrides, transient failures, malformed events, and server rejections.

## Verification
- `npm test`: 93 passed, 0 failed (Node test runner, local test doubles; not a live backend).
- Mutation experiment: intentionally treated duplicate as rejected; 4 tests failed. Restored implementation and re-ran all tests successfully.

## Important unresolved production blockers
- Supabase migration (`cloud/completion-rpc.sql`) has not been deployed or tested with live Postgres concurrency.
- The RPC does **not yet validate persisted quest assignment, required uploaded proof, prestige entitlement, or historical account time-zone snapshots**. Do not use it for production rewards until these checks are implemented.
- Existing legacy profile-state synchronization (`cloud/sync.js`) still uses last-writer snapshots and max XP merge; it can conflict with authoritative award reconciliation. It must be redesigned to separate immutable award events from preferences before enabling real multi-device use.
- Local demo storage is not yet account-isolated; do not sign in multiple accounts on one browser and assume isolation.
- Full offline artwork upload, server deletion, multi-device UX, real browser testing and full PWA performance work remain.
- Cloud SDK requires a configured Supabase project and network. The local demo remains usable without it.
