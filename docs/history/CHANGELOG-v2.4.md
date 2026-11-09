# v2.4 — encrypted-first upload pipeline (isolated integration seam)

Added `cloud/vault-upload-pipeline.mjs` and ten tests. New writes in this opt-in pipeline persist encrypted bytes to the vault before writing metadata-only queue entries. Flush decrypts in memory, checks deletion tombstones before and after upload, publishes metadata only after upload, and retains failed jobs for retries. Per-account in-flight guards prevent duplicate flushes in one runtime. Tests cover failure, retry, cross-account isolation, wrong passphrase, tombstones and concurrent flushes.

**Not wired to the existing UI**: `cloud/artwork-queue.js` still persists plaintext Blob entries and remains the active queue. Next milestone is the transactional cutover and vault unlock UI. The new pipeline assumes remote upload and metadata operations are idempotent; that property requires server tests. Encrypted bytes are decrypted for transmission to Supabase Storage; this is encryption at rest on the device, not end-to-end cloud encryption.

Test command: `npm test` (146 passed locally). Browser and deployed Supabase integration tests remain pending.
