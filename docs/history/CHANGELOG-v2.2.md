# v2.2 — Encrypted artwork repository foundation

- Added `cloud/encrypted-artwork-store.mjs`: AES-256-GCM encrypted binary artwork records, per-record PBKDF2-SHA256 salt, random IV, authenticated account/record/MIME binding.
- Added an IndexedDB adapter with account-indexed records and transactional writes.
- Added read-back verification before reporting a successful save.
- Added 10 automated tests for confidentiality-at-rest representation, wrong passphrase, tampering, account isolation, quota failures, corruption, deletion, randomization and input validation.

## Security / readiness warning
This is **not connected to the app UI or existing artwork queue**. Existing images and account state are **still stored in plaintext**. No automatic migration or cleanup has been attempted. The repository requires a passphrase on each operation and is not yet optimized for many large images (PBKDF2 per record). Never use this as evidence that all offline artwork is encrypted.

## Next integration gates
1. Explicit opt-in vault unlock UI, session key management, and clear unrecoverable-offline-data warning.
2. Safe encrypted queue migration with verified backups, crash recovery, and no plaintext writes after activation.
3. Real browser testing for IndexedDB transaction lifecycle, storage quota, multiple tabs, Safari mobile and sign-out locking.
4. Server-side concurrency, authentication, private storage and proof validation tests against deployed Supabase.
