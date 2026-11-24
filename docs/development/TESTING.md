# Test strategy and verification levels

1. **Unit:** pure mission, XP, vault and reconciliation logic.
2. **Integration:** real HTTP against local test servers, IndexedDB browser integration, and application lifecycle tests.
3. **Browser E2E:** Playwright clicking real UI, reload, offline, multiple tabs, account switching and low storage.
4. **Live backend:** test Supabase project with RLS and private Storage, unauthorized access, transactional XP uniqueness, retries and two-device races.

Current `npm test` uses Node's built-in test runner and tests the existing browser/cloud modules. It does not prove browser E2E or production Supabase readiness. `npm run build` verifies bundling, not business correctness.

## Organization and naming (approved 2026-11-24)

All test implementations now live under `tests/unit/`, `tests/integration/`,
`tests/e2e/` or `tests/static/`. See [test organization](../../tests/README.md)
for classification and command discovery. Test level belongs in the directory;
use `.test.mjs` for Node and `.browser.test.mjs` for Playwright. Browser execution
does not imply E2E coverage. Former `.http`, `.integration` and `.e2e` filename
markers were replaced by descriptive kebab-case basenames and directory placement.

The migration moved 33 Node files (18 unit, eight integration, seven static)
and retained their 219 top-level `test(...)` registrations. These are source
inventory counts, not execution results. The browser checks were embedded in
their existing Playwright entry point without dropping their assertions.
No test code remains under `frontend/`. The user reported successful
`npm run check` and `npm run test:browser` execution after the migration.
These are user-reported results; the assistant did not execute the suites.
Syntax/path checks and discovery are separate from suite execution.

Migration checks completed by the assistant: 36 JavaScript files passed syntax
checks, 52 relative module/source references resolved, and all 31 previously
Git-tracked test bodies matched their originals after normalizing relocated
paths. Playwright discovery (`npm run test:browser -- --list`) found the one
existing browser test without executing it. No test-suite pass is claimed.

Some legacy UI wiring tests inspect HTML and JavaScript source rather than executing browser behavior. Their assertions must tolerate formatting whitespace while preserving the checked operators, account guards and operation order. Source-block extraction must fail explicitly when a boundary or operation is missing; comparing two missing `indexOf` results is not a valid ordering check. These checks remain limited source inspections and do not replace behavioral browser tests.

**Migration gate:** old tests stay enabled; new Vitest/Playwright suites must add meaningful coverage before retiring old ones. Record exact commands, environment and failures in PRs.

## Meaningful feature coverage

- Identify the feature's required behavior and realistic ways it can fail before
  selecting test cases. Cover normal operation, relevant boundaries and failure
  recovery in proportion to the feature's risks, rather than maximizing test count.
- Exercise production code and assert observable outcomes. Derive expected
  results independently from the requirement; do not reproduce the implementation
  algorithm to generate its own expected answer.
- Each case must distinguish correct behavior from a plausible defect. For
  example, duplicate quest completion must assert that XP is awarded only once;
  a failed multi-record write must assert that none of its changes persisted;
  reopening a gallery must assert the saved image/link order, not just entry count.
- Use mocks for external collaborators where appropriate, but do not mock away
  the responsibility being verified. Transaction atomicity needs real IndexedDB
  integration verification; a mock that always reports success cannot prove it.
- Do not remove relevant cases, weaken assertions, catch and ignore unexpected
  failures, or skip failing checks solely to obtain a passing suite. Any justified
  change to an expected result must follow an independently established requirement
  change or a demonstrated test defect.
- Describe what each verification level actually covers and what remains untested.
  Passing imports, builds, existence checks or mock-only tests do not establish
  end-to-end correctness. Explicitly labelled smoke and static checks may supplement
  behavioral tests, but must not substitute for relevant feature coverage.

## Node suite conventions

- Use two-space indentation and separate setup, actions and assertions into readable statements. Keep fixtures local when they model different boundaries; do not merge unrelated fixtures just to reduce line count.
- Assert observable results and failure paths. A test name must match what its assertions actually verify. For example, a test mentioning fresh IV and salt must check both fields independently.
- Await or return asynchronous assertions. Use explicit signals for controlled concurrency and bounded waits for fire-and-forget events, with a useful failure message. Avoid assuming an operation has started after an arbitrary number of event-loop turns.
- Restore replaced globals and their original property descriptors in teardown, including when an assertion fails. Keep tests that share browser-global mocks sequential.
- Close local HTTP servers with test cleanup hooks. Use ephemeral loopback ports, not fixed ports or production endpoints.
- Keep source-inspection checks explicitly labelled as static checks. Tolerate formatting whitespace without removing guards or weakening operators. Require source sections and both operations to exist before comparing their order.
- Do not claim a mutation-testing run from a manually constructed duplicate fixture. Do not describe a simulated Supabase client, an in-memory vault or an IndexedDB test double as a live service or browser check.

## Local verification commands

### Playwright setup

From the repository root, install the test runner and its initial browser:

```powershell
npm install --save-dev @playwright/test
npx playwright install chromium
```

The dependency declaration, `playwright.config.mjs`, `test:browser` script and
storage integration test are present. Browser binary installation and actual
test execution must be verified on the machine running the tests. The runner
invokes native-IndexedDB profile checks automatically from
`tests/integration/local-profile.browser.test.mjs`. This is storage integration
coverage, not a complete UI E2E scenario.

Once those files are configured, run:

```powershell
npm run test:browser
```

The configured test server is `127.0.0.1:4174`, with strict port selection and no
reuse of an existing server. Playwright starts/stops it automatically and uses
Chromium headlessly with isolated test contexts. No manual Console import is
required. Existing `.gitignore` rules already exclude `test-results/` and
`playwright-report/`. Keep the existing Node and build checks enabled.

An initial Chromium run does not establish cross-browser or physical-device
compatibility. Do not report browser checks as passing until executed.

### Existing checks

From the repository root on Windows:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

For a focused check, pass explicit files to Node:

```powershell
node --test tests/static/proof-cloud-deletion.test.mjs tests/integration/artwork-queue.test.mjs
```

The user runs test suites under the current guided workflow. The HTTP tests require local connections to their test servers on `127.0.0.1`. A sandbox denial such as `connect EACCES` is an environment restriction, not an application regression. If the assistant is explicitly authorized to run tests, follow the required permission process. Do not skip those tests to obtain a passing suite.

## Test maintenance review (2026-11-16)

All 31 existing test files were reviewed and formatted. The 210 existing test cases were retained. Targeted improvements cover source-order checks, formatting-tolerant source assertions, browser-global cleanup, observable completion of deletion events, explicit upload-start signals, independent IV/salt checks, missing-slot validation and a fixed timestamp for invalid-zone validation.

The suite still has important limits: static UI checks do not execute the UI; the queue tests use an asynchronous IndexedDB test double; completion reconciliation and Supabase restoration use simulated clients; HTTP transport tests use local test servers. Browser rendering, real IndexedDB behavior and deployed Supabase authorization require separate verification. The React island integration remains a separate work item.

## Local profile browser verification (2026-11-24)

The user reported a passing manual real-IndexedDB check for
`frontend/src/storage/local-profile-repository.mjs`: concurrent initialization
returned the same profile identifier, and closing/reopening the database reused
that identifier without requesting a new one. The check used a temporary
database, removed afterwards, rather than the application's main database.

This is a user-reported browser result, not an automated suite run or an
independent assistant verification. It does not establish persistence across a
browser restart, failure recovery, migration, UI integration or full offline
operation. The user also reported passing manual checks for preservation of
invalid/multiple profiles and rejection of invalid or failed identifier generation
without persisting a profile.

The independent-connection and post-write abort checks now live inside the
Playwright integration test at `tests/integration/local-profile.browser.test.mjs`.
The former browser-console helper under application source was removed as part
of the approved test reorganization. Repeat these checks from the terminal:

```powershell
npm run test:browser
```

These checks use temporary databases and native IndexedDB transactions. Abort
injection is controlled failure instrumentation, not a simulated storage engine
or a real device/storage failure. They are not currently included in `npm test`.
