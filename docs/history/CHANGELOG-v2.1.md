# v2.1 — Offline vault security foundation

- Added Web Crypto AES-256-GCM authenticated encryption primitives with PBKDF2-SHA256 key derivation, random salts/nonces, and account-bound associated data.
- Added staged migration that verifies encrypted read-back while leaving existing plaintext untouched.
- Added 10 vault security/regression tests, including wrong key, cross-account, tampering, low storage, and no overwrite of an existing vault.
- Full local test suite: 118 passed, 0 failed.
- Mutation experiment: intentionally wrong nonce-randomness assertion failed (see PRIVATE-VAULT-MUTATION-RESULT.txt). The broken test was removed.

**Not yet integrated**: Browser storage remains plaintext. Encryption requires opt-in unlock UI, IndexedDB encrypted image pipeline, safe migration, and browser tests before activation. See cloud/PRIVATE-VAULT-PLAN.md.
