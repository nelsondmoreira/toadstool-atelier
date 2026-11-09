# Test strategy and verification levels

1. **Unit:** pure mission, XP, vault and reconciliation logic.
2. **Integration:** real HTTP against local test servers, IndexedDB browser integration, and application lifecycle tests.
3. **Browser E2E:** Playwright clicking real UI, reload, offline, multiple tabs, account switching and low storage.
4. **Live backend:** test Supabase project with RLS and private Storage, unauthorized access, transactional XP uniqueness, retries and two-device races.

Current `npm test` uses Node's built-in test runner and tests the existing browser/cloud modules. It does not prove browser E2E or production Supabase readiness. `npm run build` verifies bundling, not business correctness.

**Migration gate:** old tests stay enabled; new Vitest/Playwright suites must add meaningful coverage before retiring old ones. Record exact commands, environment and failures in PRs.
