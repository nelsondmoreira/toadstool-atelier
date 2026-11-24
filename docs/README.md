# Documentation index

- [Development rules & guidelines](../CONTRIBUTING.md) — conventions, safety gates and review process
- [Getting started](development/GETTING-STARTED.md) — run locally
- [Testing](development/TESTING.md) — coverage and verification levels
- [Branching and commit conventions](development/git-workflow.md) — branch names, commit messages, staging and review workflow
- [Current architecture](architecture/CURRENT-STATE.md) — honest state of the prototype
- [Target structure](architecture/TARGET-STRUCTURE.md) — migration destination
- [Stack decision record](decisions/0001-technology-stack.md) — rationale, overlap avoidance, deferred decisions
- [React island boundaries](decisions/0002-react-island-boundaries.md) — approved visual ownership, CSS rules and manual integration steps
- [Offline customization synchronization](decisions/0003-OfflineCustomizationSync.md) — version ordering, conflict preservation and recovery limits
- [Local application storage](decisions/0004-local-storage.md) — approved IndexedDB stores, references, atomicity and migration constraints
- [Supabase operations](operations/SUPABASE.md) — backend setup and security gate
- [Architecture notes](architecture/README.md) — existing domain documents
- [Historical reports](history/) — previous changes and test output

Architectural changes should add or update a numbered ADR under `decisions/` after owner approval.
