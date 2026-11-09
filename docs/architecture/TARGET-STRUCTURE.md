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
      infrastructure/      # Supabase client, IndexedDB adapters, vault, sync
    public/
  backend/
    supabase/
      migrations/
      functions/
  tests/
    integration/
    e2e/
  docs/
    architecture/
    decisions/
    development/
    operations/
  .github/workflows/
```

**Status:** target, not current reality. Do not confuse folder names with completed migrations.

Feature code should be colocated; shared is for genuinely shared code only. Backend remains Supabase, not a redundant NestJS server. The existing browser modules and tests remain in their current locations until imports and functionality can be migrated safely.
