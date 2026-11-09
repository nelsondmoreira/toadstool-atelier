# v3.0: active inspiration gallery encrypted writes

- New signed-in inspiration image uploads are saved as encrypted bytes in IndexedDB, not data URLs in account-local JSON.
- Gallery state contains only an encrypted-image ID and MIME type. The actual gallery resolves decrypted bytes to temporary object URLs, revoked on account switch and deletion.
- New account-change checks prevent a delayed file read from writing into another account.
- Gallery deletion removes the encrypted local record before removing its metadata, and preserves the entry on deletion failure.
- Added five functional tests using the real AES-GCM repository, vault session, and gallery controller together.

## Known blockers

- Existing plaintext gallery entries remain untouched; no destructive migration was attempted.
- Quest proofs, Atelier proof and custom badge images still use plaintext application state.
- Gallery object URL loading and actual IndexedDB need real browser tests; no browser pass is claimed.
- Cloud download/restoration and live Supabase integration remain unfinished.
- This version intentionally requires sign-in for new encrypted gallery image uploads. URL references remain usable in demo mode.
