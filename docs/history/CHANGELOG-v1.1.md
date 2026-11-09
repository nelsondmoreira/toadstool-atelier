# v1.1 — Proof drawing deletion

- Earned badges keep their acquisition date and status when proof drawings are deleted.
- A confirmation prompt prevents accidental local deletion.
- Proof viewer and delete button reset when switching badges.
- Offline upload queue cancels matching pending proof uploads upon deletion.

## Known limitations

- Cloud-stored proof images are **not yet deleted** by this build. Durable remote deletion jobs and authoritative asset-to-badge IDs are required before promising cloud deletion.
- Local proof images are still stored in the legacy localStorage app state; IndexedDB migration and account-isolated storage remain outstanding.
- The current cloud sync may restore an older proof from another device; do not treat deletion as fully synchronized until tombstones are integrated.
- Automated tests cover local behavior and queue cancellation code, not live Supabase or browser-level flows.
