# Current architecture audit

This archive is a **transitional vanilla JavaScript prototype**, not a completed React/TypeScript migration.

- `frontend/index.html`: large page markup and UI anchors.
- `frontend/src/app.mjs`: stateful UI logic and event handlers.
- `frontend/cloud/`: existing offline vault, queue, auth and cloud modules.
- `frontend/src/storage/`: the new consolidated local database and profile modules.
- `tests/`: centralized unit, integration, static and future UI E2E tests.
- `backend/supabase/`: schema and Edge Function source.
- `docs/architecture/`: earlier domain-specific architecture notes.

Known issues: DOM-heavy UI, incomplete separation of presentation and domain state, incomplete cloud/browser verification.

## Technology responsibilities and adoption status

| Technology | Responsibility | Status |
| --- | --- | --- |
| Vite | Development server and production bundling. | Configured. |
| React and TypeScript | Typed UI components through incremental React islands. | Installed; migration incomplete. |
| IndexedDB and Web Crypto | Local persistence and the existing encrypted artwork format. | Existing repositories; consolidated local storage integration pending (ADR-0004). |
| Node test runner | Existing automated module and integration tests. | Configured as `npm test`. |
| Playwright | Real-browser storage integration and offline UI verification from the terminal. | Dependency and configuration present; the user reported passing browser checks after test reorganization. Complete offline UI coverage remains pending. |
| Supabase | Optional future authentication, cloud storage and synchronization. | Source exists; deployment not verified; outside the initial local cycle. |
| Vitest | Future frontend testing direction. | Deferred; not introduced with Playwright. |
| GitHub Actions and Pages | Demo frontend publication, optional fast mode, pause/unpublish controls. | Local checks and first checked one-shot publication reported successful by the user; remaining live modes unverified (ADR-0005). |

Playwright browser automation is not proof of physical mobile-device behavior,
deployed backend correctness or application offline readiness by itself.

Safe migration order: (1) establish documentation and baseline; (2) introduce React+TS build with isolated feature parity; (3) migrate app shell and one feature at a time; (4) migrate tests to Vitest and add Playwright; (5) remove legacy UI only after parity, encrypted storage and account-scope checks.
