# Toadstool Atelier — Development Rules & Guidelines

**Status:** Team conventions approved as a baseline. Changes to architecture require product-owner approval.  
**Scope:** All application code, tests, infrastructure, documentation and pull requests.

## 1. Core principles

1. Prefer the simplest solution that meets the actual requirement. Do not add dependencies, frameworks, layers or abstractions without a demonstrated benefit.
2. Give each technology one clear responsibility. Avoid two libraries solving substantially the same problem.
3. Organize code by **feature and responsibility**, not by dumping unrelated logic into a single file. Keep genuinely shared utilities small and independent.
4. Preserve offline-first behavior, private artwork, account isolation and user data during refactors.
5. Ship observable, testable functionality. Never describe a mock-only test as live-backend verification.
6. Maintain consistent naming, formatting, error handling and documentation.
7. **Do not make architectural decisions without product-owner approval.** Routine implementation details within approved architecture may proceed.

## 2. Approved architecture and boundaries

- **Frontend:** React + TypeScript + Vite (migration target; legacy JavaScript stays until safely replaced). React is the sole UI framework.
- **Backend:** Supabase Auth, PostgreSQL, private Storage and Edge Functions. No NestJS/Express or second API server unless approved.
- **Offline:** Browser IndexedDB and existing encrypted repositories. Do not add Dexie until the need and migration plan are approved.
- **Validation:** TypeScript for static typing; Zod only at untrusted runtime boundaries where warranted.
- **Testing:** Gradually move frontend tests to Vitest and browser E2E to Playwright. Keep existing Node tests working until equivalent coverage is verified.
- Do not introduce routing, global state, CSS, UI, ORM, caching, logging or service-worker frameworks without a written proposal and approval.

See [ADR-0001](docs/decisions/0001-technology-stack.md) and [target structure](docs/architecture/TARGET-STRUCTURE.md).

## 3. Project layout and naming

- `frontend/`: browser application, with `src/features/<feature>/` for feature-owned components, hooks, services, types and tests; `src/shared/` only for truly reusable code.
- `backend/supabase/`: database migrations, policies, storage configuration and Edge Functions.
- `docs/`: architecture, development, decisions, operations and historical reports.
- Keep tests near the code they exercise (`*.test.ts` / `*.test.tsx`); put cross-feature browser scenarios in `tests/e2e/` when Playwright is introduced.
- Use **PascalCase** for project-defined file basenames, including non-component modules (for example `MountWeeklyProgress.tsx`); use **camelCase** for functions, methods, variables and hooks (for example `mountWeeklyProgress` and `useGallery`). React component identifiers remain **PascalCase** for JSX. Use **kebab-case** for feature directories and **UPPER_SNAKE_CASE** for module-level constants where appropriate.
- Preserve tool-defined filenames such as `package.json`, `tsconfig.json`, `index.html` and `AGENTS.md`, and conventional test suffixes such as `.test.mjs` (`AccountScope.test.mjs`). Apply the convention to new files; migrate legacy filenames deliberately instead of performing unrelated bulk renames. Import paths must match the exact filename casing recorded by Git, including on case-insensitive development systems.
- One clear exported responsibility per module; avoid giant components, circular imports and cross-feature imports into internal implementation details. Extract shared contracts only when actually shared.

## 4. TypeScript, UI and styling

- Prefer strict TypeScript; avoid `any`, unchecked assertions and suppressions. Explain any unavoidable exception.
- Keep rendering separate from persistence, authentication, network calls and domain rules.
- Handle loading, offline, empty, error and pending-sync states explicitly. Never silently discard user input.
- Design phone-first and accessible: semantic controls, keyboard navigation, visible focus, readable contrast, labels and reduced-motion support.
- Keep the established cozy tone and low-pressure progression. Do not introduce streak penalties, competitive leaderboards, proof requirements for ordinary missions or other product changes without approval.
- Use a consistent styling approach within the approved stack; do not mix multiple styling systems for the same purpose.

## 5. Data integrity, privacy and security

- Scope local data, remote paths, cache entries and queues to the authenticated account. Clear visible private state on sign-out or account switch.
- Do not log secrets, passphrases, access tokens, raw private artwork or personally identifying data.
- Never commit `.env` files, service-role keys, tokens or production data. Only publish sanitized `.env.example` templates.
- Keep encrypted artwork encrypted at rest locally; do not weaken key handling or remembered-unlock behavior casually.
- Treat Supabase Row Level Security and private storage authorization as mandatory; client checks are not a substitute.
- Award XP through server-authoritative, idempotent transactions. Duplicated offline completions must not duplicate XP.
- For migrations and deletions: preserve referenced artwork, make retries idempotent, and test interruption/recovery paths. Follow explicit user-approved permanent deletion semantics.
- Any changes to encryption, recovery, data retention, account isolation, XP rules or synchronization conflict handling require an ADR and approval **before implementation**.

## 6. Testing and definition of done

- Every behavior change must include or update meaningful tests; add regression tests for fixed bugs.
- Test success, failure, retries, offline state, account switching and data integrity where relevant.
- Integration tests must exercise real boundaries when feasible (HTTP/database/browser); distinguish stubs, local servers and live Supabase.
- Run the available test suite and production build before claiming completion. Record exact commands and results, including limitations.
- Do not claim browser verification, live-cloud security, or test counts without actually running those checks.
- A change is done when: behavior is implemented, existing behavior is preserved, relevant tests pass, documentation is updated, and known risks are disclosed.

## 7. Git and review workflow

- `main` is the stable branch. Use GitHub Flow: create short-lived branches from `main`, open a pull request, run required CI checks, review, and merge only when checks pass. No permanent `develop` branch unless approved.
- Branch names follow `type/short-kebab-case-description`. Approved types: `feat/` (new functionality), `fix/` (bug fixes), `refactor/` (behavior-preserving restructuring), `docs/` (documentation), `test/` (tests), and `chore/` (tooling and maintenance).
- Example: `refactor/frontend-react-typescript`. Keep branches focused and delete them after merging.
- Make focused commits with descriptive imperative messages (for example `feat: restore gallery artwork after sign-in`).
- Avoid mixing a large structural refactor with unrelated features or visual redesign.
- Review the diff, run checks and summarize behavior changes, tests, migrations and outstanding risks before merging.
- Never commit generated dependencies, local databases, credentials or private user artwork.

## 8. Documentation conventions

- Root `README.md`: what the project is and where to start.
- `docs/development/`: installation, run commands, testing, troubleshooting and contributor workflows.
- `docs/architecture/`: current and target architecture, boundaries, data flows and storage models.
- `docs/decisions/`: numbered ADRs describing context, options, trade-offs, decision, approval and consequences.
- `docs/operations/`: deployment, environment configuration, Supabase migrations, backups and recovery.
- `docs/history/`: historical reports, not current instructions.
- Update documentation in the **same change** as the behavior it describes. Do not document a proposed capability as already implemented.

## 9. Architectural decision process

Before changing frameworks, persistence libraries, authentication, backend architecture, encryption, routing, global state, deployment platform, or other cross-cutting choices:

1. Describe the problem and why the current approach is insufficient.
2. Compare a minimal viable alternative against the proposed technology, including dependencies, maintenance, migration and security costs.
3. Recommend one option and request explicit product-owner approval.
4. Once approved, record the decision in `docs/decisions/NNNN-topic.md` and implement it incrementally with tests.

**If approval is missing, do not make the architectural change.**

## 10. Migration-specific rule

The existing JavaScript prototype is the baseline, **not** evidence that React migration is complete. Migrate incrementally, maintain runnable checkpoints, and verify behavior before removing legacy paths. Avoid duplicate permanent implementations of the same feature.
