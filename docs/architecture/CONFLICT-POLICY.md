# v0.7 — conflict ordering and edge cases

**Chosen policy:** the latest *user-confirmed* Atelier design wins, even if its upload finishes first or last. Save `confirmedAt` (ISO UTC), `operationId` (UUID), file blob, crop settings and slot in the durable IndexedDB queue **when the user confirms**; retries must reuse those exact values. Compare `(confirmedAt, operationId)` to make ties deterministic. An old offline upload that finishes later cannot overwrite a newer edit. A duplicate operation is idempotent. Only the winning design becomes active; losing uploaded blobs should be scheduled for cleanup.

`design-conflicts.mjs` and `design-conflicts.test.mjs` implement and test the pure conflict policy and a mockable adapter contract. `schema.sql` adds ordering metadata. **Not yet live:** the Supabase transaction/RPC, real storage adapter, end-to-end UI integration, and two-device tests. The current app still uses local designs.

**Critical edge case:** device clocks can be skewed or manually changed. Client confirmation timestamps cannot perfectly establish real-world order across offline devices. Production options include clock-skew warnings, a trusted server time offset established while online, or prompting when timestamps are unreliable. Do not claim strict real-world latest-wins until this is addressed.

**Critical security:** the server, not the browser, must atomically compare versions and schedule cleanup. Enforce ownership, slot unlock authorization, asset ownership and private storage policies; never trust a client-supplied user ID alone. Prevent stale clients from directly updating the design pointer table. Do not delete proof drawings. A failed cleanup should be retried; check all live references before deleting. On account switch, clear in-memory image URLs and scope IndexedDB records to account ID.

Run tests: `node --test cloud/*.test.mjs`.
