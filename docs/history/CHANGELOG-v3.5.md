# v3.5 — Durable local encrypted artwork cleanup

- Added persistent IndexedDB cleanup journal for encrypted uploads interrupted after encrypted bytes are stored but before upload queue metadata is committed.
- Integrated cleanup scheduling into the actual artwork queue for queue-commit failures and account switches during encryption.
- On online flush, retry cleanup for the signed-in account. Each cleanup rechecks the upload queue for a live reference immediately before deleting.
- Account-scoped cleanup, retry after storage failures, concurrent-run suppression and explicit cancel supported.
- Added seven behavioral cleanup tests plus a wiring regression test.

## Remaining limitations

- This is local orphan cleanup for queue-owned encrypted files, not a global garbage collector for gallery, proof or Atelier assets.
- The separate cloud deletion tombstone flow remains in place; remote orphan cleanup and cloud restoration still need live backend tests.
- Browser IndexedDB behavior and the live Supabase service have not been tested in this iteration.
- A process crash between saving encrypted bytes and writing a cleanup job can still leave an orphan; a future reference-indexed sweep is required to close that crash window safely.
