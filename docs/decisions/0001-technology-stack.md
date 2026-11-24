# ADR-0001: Technology stack and complexity budget

Status: **Proposed implementation of the stack discussed with the product owner; specific substitutions require approval**

## Context
Toadstool Atelier is a phone-first offline-capable art practice PWA with account-scoped encrypted artwork, quests and progression. The current prototype is vanilla JS with Vite, browser IndexedDB modules and Supabase code.

## Selected direction
- React + TypeScript + Vite for frontend UI, type checking and build. React is the *only* UI framework.
- Supabase Auth, PostgreSQL, private Storage and Edge Functions as the backend. No NestJS, Express, Prisma or second API layer by default.
- IndexedDB for offline data. **Dexie is deferred**, not automatically installed: first measure whether the existing tested repository needs it. Do not use Dexie and another IndexedDB abstraction simultaneously.
- Vitest for frontend unit/integration tests, Playwright for browser E2E. Existing `node --test` coverage remains operational during migration; retire overlapping harnesses once parity is verified.
- Zod only for validating untrusted runtime boundaries, not for duplicating every TypeScript type.
- No state-management library, CSS framework, router, service-worker helper or UI component library without a demonstrated need and product-owner approval.

## Constraints
- Never migrate offline encryption formats or storage schemas without verified rollback-safe migration and account isolation.
- Server owns authoritative XP, uniqueness, prestige and entitlement checks.
- A passing mock-client test is not proof of live Supabase authorization.
- Keep stable prototype runnable until feature parity is established.

## Explicitly deferred choices
Routing library, CSS styling system, IndexedDB library, service worker strategy, deployment platform, React state strategy, and whether to split shared types into a workspace package. These are architectural decisions requiring approval when needed.

## Playwright adoption (approved 2026-11-24)

The owner approved introducing Playwright now for repeatable real-browser
IndexedDB integration checks and, subsequently, the complete offline UI cycle.
Install `@playwright/test` as a development dependency. Existing Node tests
remain enabled; neither Vitest nor fake-indexeddb is introduced by this decision.

Playwright runs a browser automatically from the terminal, headless by default.
It is test tooling, not application runtime code. Initial setup uses Chromium;
that does not establish Firefox, WebKit or physical mobile-device compatibility.
Start a separate local Vite server for tests and use isolated browser contexts
and temporary databases. Do not use a personal browser profile or production data.

The dependency declaration and configuration are now present. Test code is
centralized by level under `tests/` as approved on 2026-11-24. Browser tests
use `.browser.test.mjs`; Node tests use `.test.mjs`. See `tests/README.md` and
the testing guide for discovery, commands and verification limits. The user
reported successful Node/build and browser checks after the reorganization;
this does not establish complete UI E2E or mobile-device coverage.
