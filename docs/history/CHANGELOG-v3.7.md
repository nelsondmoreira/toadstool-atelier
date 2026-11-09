# v3.7 — Supabase gallery restoration wiring

- Added an account-scoped Supabase artwork manifest/download adapter for inspiration images.
- Connected cloud gallery restoration to authenticated account and vault-ready lifecycle.
- Restored cloud images are encrypted locally through the existing vault and merged into the visible gallery only after successful verification.
- Added account generation checks, local-first collision handling, and idempotent gallery merging.
- Added three targeted integration tests of the Supabase client contract and gallery persistence.

## Important limitations
- The targeted tests use an in-process Supabase-compatible fake, not a live Supabase database or browser.
- Cloud artwork recovery after losing the vault passphrase is not yet implemented.
- Gallery metadata sync, proof restoration, storage RLS verification, and browser end-to-end checks remain incomplete.
- A vault without a remembered unlock will defer restoration until it is unlocked.
