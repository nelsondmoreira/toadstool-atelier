# v2.6 — Remote deletion cleanup and real HTTP regression

- Vault upload pipeline now accepts `removeRemote` callback for idempotent cleanup of deleted uploads.
- A tombstone before an upload flush cleans up any remote bytes left by a previous interrupted flush, then removes the pending queue item only after cleanup succeeds.
- A tombstone arriving while an upload is in flight deletes the remote bytes before acknowledging the queue item; metadata is not published.
- Failed remote deletion keeps the queue item pending for retry.
- HTTP transport adds authenticated `/artwork/delete` request. This endpoint is part of the **local test API contract**, not a deployed Supabase endpoint.
- Added 3 tests (including one using a real local HTTP server). Suite: 154 passed, 0 failed on this environment.

## Limitations

The existing browser UI still writes images to plaintext local state and has not been connected to the encrypted-first pipeline. This change improves the separately tested pipeline, not production UI encryption. Browser automation was attempted but Chromium navigation was blocked by the execution environment; no browser test pass is claimed. Supabase endpoint and live RLS testing remain outstanding.

## Next required integration

Implement an authenticated Supabase Storage remove operation with ownership checks and connect it to the actual UI's proof/gallery deletion workflow, then test browser IndexedDB and remote restoration end-to-end.
