# Test organization

| Directory | Responsibility | Runner |
| --- | --- | --- |
| `unit/` | Isolated module behavior, with controlled collaborators where needed. | Node |
| `integration/` | Interactions between production modules, local HTTP or real IndexedDB. | Node or Playwright |
| `e2e/` | Complete user journeys through the interface. | Playwright |
| `static/` | Explicit source/HTML/SQL inspection; no runtime behavior guarantee. | Node |

Use kebab-case for descriptive basenames. Directory names identify the test
level; do not repeat `.integration` or `.e2e` in filenames. Use `.test.mjs` for
Node tests and `.browser.test.mjs` for Playwright tests. A browser environment
does not make a repository test an E2E test.

Keep test code outside `frontend/`. Mirror or extend domain subdirectories
within each level when needed. Preserve meaningful assertions during moves.

## Commands

```powershell
npm test
npm run test:browser
npm run check
```

`npm test` uses `scripts/run-node-tests.mjs` to discover Node tests recursively
under unit, integration and static, excluding browser files. Additional Node
runner options can be passed after `--`. `npm run test:browser` discovers
`*.browser.test.mjs` throughout `tests/`, including integration and future E2E
tests. `npm run check` retains its existing scope: Node tests and production
build; run browser tests separately.

## Classification limits

Unit tests may exercise real Web Crypto while using in-memory persistence.
Integration tests include real-module composition with simulated external
services, as well as local HTTP and real-browser IndexedDB. Their directory
does not imply live Supabase or real browser coverage: inspect each fixture.

The previous `artwork-http.e2e.test.mjs` is now an HTTP integration test, not a
UI journey. The old localStorage profile tests remain as unit coverage for the
legacy module until it is deliberately retired. No existing cases were removed
to perform this reorganization.
