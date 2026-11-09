# Pocket Art Helper v3.6 — Cloud artwork restoration foundation

## Added
- `cloud/artwork-restoration.mjs`: authenticated HTTP list/download transport and account-scoped restoration coordinator.
- Restores verified cloud image bytes into the existing AES-GCM encrypted local vault; never stores downloaded plaintext bytes in the local repository.
- Existing local artwork is never overwritten; failed items are reported independently and can be retried.
- Account session generation guards prevent cross-account commits when a download is interrupted by sign-out.
- Manifest validation, MIME/size validation and duplicate-entry rejection.
- Six real HTTP integration tests against a local server, including authentication denial, retry, and sign-out race.

## Verification
- `npm test`: 207 passed, 0 failed (2026-11-09).

## Still pending
- Wire restoration into gallery login/refresh lifecycle and account-scoped artwork metadata.
- Implement production Supabase authenticated listing and downloading with row-level security.
- Browser-driven IndexedDB and frontend integration tests.
- Authenticated recovery and reliable cleanup of unreferenced files.

## Security caveat
- HTTP test server simulates server-enforced account authorization; it is not Supabase.
- The downloaded cloud image is plaintext in memory and is re-encrypted for local storage. Production cloud storage must enforce authorization and recovery semantics separately.
