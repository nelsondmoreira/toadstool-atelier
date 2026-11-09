# Current architecture audit

This archive is a **transitional vanilla JavaScript prototype**, not a completed React/TypeScript migration.

- `frontend/index.html`: large page markup and UI anchors.
- `frontend/src/app.mjs`: stateful UI logic and event handlers.
- `frontend/cloud/`: offline vault, queue, auth and cloud modules; tests currently colocated.
- `backend/supabase/`: schema and Edge Function source.
- `docs/architecture/`: earlier domain-specific architecture notes.

Known issues: DOM-heavy UI, incomplete separation of presentation and domain state, test colocations, incomplete cloud/browser verification.

Safe migration order: (1) establish documentation and baseline; (2) introduce React+TS build with isolated feature parity; (3) migrate app shell and one feature at a time; (4) migrate tests to Vitest and add Playwright; (5) remove legacy UI only after parity, encrypted storage and account-scope checks.
