# v3.1 — Legacy inspiration-gallery migration

- Added `cloud/gallery-legacy-migration.mjs` and wired it to the gallery-vault-ready event in `index.html`.
- Signed-in legacy gallery data URLs are encrypted in IndexedDB, decrypted for readback, then replaced with ID-only metadata in account-scoped app state.
- Existing originals remain intact if encryption, readback, or state persistence fails. Account switches cancel further commits. Links are untouched. Repeated migration skips already-migrated images.
- Five new functional tests exercise real WebCrypto AES-GCM and the gallery controller, retry idempotency, failures, account switching and malformed images.
- `npm test`: 180 passed, 0 failed on 2026-11-09.

## Still open

- Browser-click tests and real Supabase storage tests have not been run.
- Legacy Atelier designs, quest proofs, badge proof records, and other plaintext paths are not migrated by this change.
- Cloud download/restoration, vault recovery, and deployed-backend concurrency tests remain unfinished.
- If account switches mid-migration after encrypted bytes are written but before metadata commit, an orphaned encrypted record may remain. It does not expose plaintext; orphan cleanup is future work.
