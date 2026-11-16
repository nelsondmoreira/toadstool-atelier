# Test strategy and verification levels

1. **Unit:** pure mission, XP, vault and reconciliation logic.
2. **Integration:** real HTTP against local test servers, IndexedDB browser integration, and application lifecycle tests.
3. **Browser E2E:** Playwright clicking real UI, reload, offline, multiple tabs, account switching and low storage.
4. **Live backend:** test Supabase project with RLS and private Storage, unauthorized access, transactional XP uniqueness, retries and two-device races.

Current `npm test` uses Node's built-in test runner and tests the existing browser/cloud modules. It does not prove browser E2E or production Supabase readiness. `npm run build` verifies bundling, not business correctness.

Some legacy UI wiring tests inspect HTML and JavaScript source rather than executing browser behavior. Their assertions must tolerate formatting whitespace while preserving the checked operators, account guards and operation order. Source-block extraction must fail explicitly when a boundary or operation is missing; comparing two missing `indexOf` results is not a valid ordering check. These checks remain limited source inspections and do not replace behavioral browser tests.

**Migration gate:** old tests stay enabled; new Vitest/Playwright suites must add meaningful coverage before retiring old ones. Record exact commands, environment and failures in PRs.

## Maintaining the existing Node suite

- Use two-space indentation and separate setup, actions and assertions into readable statements. Keep fixtures local when they model different boundaries; do not merge unrelated fixtures just to reduce line count.
- Assert observable results and failure paths. A test name must match what its assertions actually verify. For example, a test mentioning fresh IV and salt must check both fields independently.
- Await or return asynchronous assertions. Use explicit signals for controlled concurrency and bounded waits for fire-and-forget events, with a useful failure message. Avoid assuming an operation has started after an arbitrary number of event-loop turns.
- Restore replaced globals and their original property descriptors in teardown, including when an assertion fails. Keep tests that share browser-global mocks sequential.
- Close local HTTP servers with test cleanup hooks. Use ephemeral loopback ports, not fixed ports or production endpoints.
- Keep source-inspection checks explicitly labelled as static checks. Tolerate formatting whitespace without removing guards or weakening operators. Require source sections and both operations to exist before comparing their order.
- Do not claim a mutation-testing run from a manually constructed duplicate fixture. Do not describe a simulated Supabase client, an in-memory vault or an IndexedDB test double as a live service or browser check.

## Local verification commands

From the repository root on Windows:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

For a focused check, pass explicit files to Node:

```powershell
node --test frontend/cloud/proof-cloud-deletion.test.mjs frontend/cloud/artwork-queue.integration.test.mjs
```

The HTTP tests require local connections to their test servers on `127.0.0.1`. A sandbox denial such as `connect EACCES` is an environment restriction; rerun with the required permission before treating it as an application regression. Do not skip those tests to obtain a passing suite.

## Test maintenance review (2026-11-16)

All 31 existing test files were reviewed and formatted. The 210 existing test cases were retained. Targeted improvements cover source-order checks, formatting-tolerant source assertions, browser-global cleanup, observable completion of deletion events, explicit upload-start signals, independent IV/salt checks, missing-slot validation and a fixed timestamp for invalid-zone validation.

The suite still has important limits: static UI checks do not execute the UI; the queue tests use an asynchronous IndexedDB test double; completion reconciliation and Supabase restoration use simulated clients; HTTP transport tests use local test servers. Browser rendering, real IndexedDB behavior and deployed Supabase authorization require separate verification. The React island integration remains a separate work item.
