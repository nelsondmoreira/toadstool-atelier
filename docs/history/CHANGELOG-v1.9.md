# v1.9 — synchronization correctness hardening

- Added `cloud/ledger-merge.mjs`, an isolated deterministic merge algorithm keyed by prestige cycle and completion identity.
- Fixed a race where a rejected server completion could be resurrected by a stale in-flight local snapshot.
- Server snapshot overrides local award XP; newly recorded offline events survive an in-flight synchronization.
- A successful RPC missing from a stale server snapshot remains pending rather than silently disappearing.
- Added eight regression tests and demonstrated a deliberate mutation fails the rejection regression test.

## Scope and remaining production blockers

This release improves **local synchronization logic**, not a deployed cloud service. Live Supabase concurrency, server validation of quest assignment/proof/prestige, account-scoped local data and private artwork restoration on a new device remain unfinished. The current browser app still uses a global local-storage state key, which is not safe for shared-device account isolation. Do not treat this as production-ready.

Run tests: `npm test` from the extracted project directory. Serve `index.html` over HTTP rather than `file://`.
