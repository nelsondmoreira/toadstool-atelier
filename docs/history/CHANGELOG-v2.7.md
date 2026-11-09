# v2.7 — Remembered vault unlock foundation

## Added
- `cloud/remembered-vault.mjs`: account-scoped AES-GCM remembered passphrase envelope, protected with a non-extractable device-local CryptoKey stored in IndexedDB.
- `indexedRememberedVaultAdapter`: real IndexedDB persistence adapter for device key and per-account encrypted envelopes.
- Six regression tests covering persistence across module recreation, account isolation, ciphertext tampering, missing device key, per-account revocation and invalid inputs.

## Security and integration status
- This is a tested module, **not yet wired into the app's sign-in or gallery UI**.
- A non-extractable CryptoKey is still usable by same-origin scripts; this does not defend against XSS, malicious extensions, or an unlocked browser profile.
- Sign-out should clear decrypted secrets from app memory and hide private data. The user-selected *remember on this device* option retains an encrypted unlock envelope; offer an explicit Forget this device action.
- Device key loss means the user must enter the passphrase again. If they forgot it, reset must use authenticated cloud copies that were stored in recoverable form. Existing cloud upload pipeline currently sends decrypted image bytes over HTTPS; end-to-end cloud encryption and server-side recovery are separate, mutually constraining design choices.
- Do not delete unsynced encrypted data on passphrase reset without clear confirmation; an account reset cannot decrypt orphaned local ciphertext.
- Migration, real-browser IndexedDB tests, UI wiring, and live Supabase recovery are still pending.

## Tests
`npm test` — 160 passed, 0 failed (Node 2026-11-09).
