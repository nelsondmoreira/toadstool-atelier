# Target project organization (approved direction, migration pending)

```text
toadstool-atelier/
  frontend/
    src/
      app/                 # app composition, routing, providers
      features/            # missions, quests, gallery, atelier, profile, auth
        gallery/
          components/
          hooks/
          services/
      shared/              # reusable UI and cross-feature utilities only
      storage/             # local IndexedDB persistence (ADR-0004)
      infrastructure/      # Supabase client, other infrastructure integrations
    public/
  backend/
    supabase/
      migrations/
      functions/
  tests/
    unit/
    integration/
    e2e/
    static/
  docs/
    architecture/
    decisions/
    development/
    operations/
  .github/workflows/
```

**Status:** target, not current reality. Do not confuse folder names with completed migrations.

Feature application code should be colocated; shared is for genuinely shared code only. Tests are centralized by level under `tests/`, as approved on 2026-11-24; see `tests/README.md`. Backend remains Supabase, not a redundant NestJS server. Existing browser modules remain in their current locations until deliberately migrated with updated imports and verification.

ADR-0004 approves `frontend/src/storage/` for local persistence. Authentication
and cloud integration are deferred for the initial local cycle; their earlier
presence in this target does not make them prerequisites for offline use.
