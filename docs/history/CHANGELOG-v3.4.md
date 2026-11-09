# v3.4 — Legacy proof migration

- Added `cloud/legacy-proof-migration.mjs`, an account-scoped, incremental migration for legacy plaintext `questProof`, `achievements[].proof`, and `atelierDone[id].proof`.
- Integrated migration into the existing `pah:gallery-vault-ready` event, after the vault is available.
- Proof bytes are encrypted in the existing gallery vault and read back before account state is updated to `vault:<id>`.
- Preserves originals on failure, stops on account switches or changed proof values, and skips already migrated records.
- Added six functional tests, including AES-GCM repository integration and race conditions.
- Full Node suite: 193 passed, 0 failed. Mutation experiment: inverted readback verification, test suite failed as intended, then restored and reran successfully.

## Outstanding

- Real browser UI testing and deployed Supabase verification remain incomplete.
- Failed/interrupted migrations can leave orphaned encrypted records; persistent cleanup is next.
- Migration does not remove plaintext copies from old browser backups or browser storage internals; those require a separate security policy.
