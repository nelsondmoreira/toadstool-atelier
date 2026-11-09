# v2.3 — safe encrypted artwork migration staging

Added `cloud/artwork-vault-migration.mjs`, an explicit, opt-in staging helper for pending upload queue records. It copies account-scoped image bytes to the encrypted repository and verifies decrypted bytes match the originals. It never deletes or modifies plaintext originals, never persists unlock secrets, reports individual failures, prevents overlapping staging operations, and supports idempotent retries.

This helper is NOT automatically invoked by the app. A production cutover requires: an account-scoped unlock UX; a vault-aware queue which never persists plaintext on new writes; safe reconciliation with in-flight uploads and proof deletion tombstones; an atomic/transactional cutover marker; and browser/device tests. No claim of end-to-end encryption or deployed Supabase validation is made.

Tests: `npm test` (Node built-in runner). Eight new migration tests, 136 total passing in this local run.
