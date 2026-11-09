# v1.2 — Immediate proof deletion groundwork

- Confirmed proof deletion keeps badge and acquired date.
- Offline IndexedDB deletion tombstones are recorded before pending uploads are cancelled.
- Cloud SQL RPC creates durable server tombstones and queues storage paths for removal; stale metadata writes are rejected.
- Cleanup acknowledgement and retry added to the cloud queue.
- Cloud deletion is not live until Supabase is configured and SQL migrations are applied.

## Known gaps

- Local badge state still uses browser localStorage, not the cloud artwork library.
- A fully concurrent upload/delete race and cross-device restore need browser and live Supabase integration tests.
- Proof deletion tombstones are permanent; reusing the same slot to submit a new proof is not supported.
- Storage cleanup assumes cloud records have accurate kind/slot metadata.
