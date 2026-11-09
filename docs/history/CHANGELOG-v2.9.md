# v2.9 — Active encrypted cloud-upload queue

- Wired the existing `setupArtworkQueue` UI event handlers to an account-bound vault session.
- New optimized artwork bytes are encrypted in IndexedDB before upload metadata is queued; new queue entries no longer contain plaintext `blob` fields.
- Remembered unlock restores a device-local passphrase when available; first use prompts for a 12+ character passphrase and remembers it on that device.
- On sign-out/account switch, the active vault secret is discarded. Account-switch checks surround async encryption and cloud transmission.
- Pending encrypted entries are decrypted in memory for authenticated upload; proof deletion removes local encrypted pending bytes.
- Older plaintext pending entries remain readable to avoid destructive migration. They are **not** yet encrypted.
- Main gallery and badge previews still embed plaintext data in local profile JSON; vault encryption is not yet end-to-end.
- Cloud recovery, browser-driven tests, and live Supabase tests are not complete.

## Tests

Run `npm test`. Local result: 170 passing, 0 failing. These include module behavior and source-wiring tests; they do not substitute for real browser/production backend verification.
