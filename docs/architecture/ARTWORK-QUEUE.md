# v0.5 private offline artwork queue

This iteration adds a real IndexedDB Blob queue and Supabase private Storage upload worker. It is a development foundation, **not complete cross-device artwork synchronization**.

## Setup
1. Configure `cloud/config.js` and Supabase Auth as in README.md.
2. For a NEW project, run the complete `schema.sql`. For an EXISTING v0.4 project, run only the `v0.5` artwork_assets section appended at the end of schema.sql.
3. Serve the project directory over localhost HTTP(S); the single HTML file alone cannot load the ES module dependencies.
4. Sign in, upload a proof drawing or gallery image, and inspect the `artist-artwork` private bucket and `artwork_assets` table.
5. Test offline uploads using browser devtools, reconnect, then confirm the pending count clears. Verify an unrelated account cannot list or download those assets.

## Current behavior and limitations
- New gallery images, weekly quest proofs and Atelier challenge proofs are queued immediately on file selection when signed in. The local prototype still stores its own base64 image copy; this can exceed browser storage quotas.
- The queue stores actual File/Blob data in IndexedDB scoped to the authenticated user ID. Items from another user are never uploaded under the current user.
- On reconnection or page return, queued items upload to paths beginning with the account UUID. Metadata is stored only after successful upload. Retried uploads tolerate an existing object with the same ID.
- **Badge design uploads are NOT queued yet**: their crop/confirmation state needs a separate finalization event. This avoids accidentally uploading discarded designs.
- Images previously stored by older builds are **not migrated** automatically. A user-approved migration flow is required.
- Uploaded images are not yet pulled to another device or shown via signed URLs; local rendering is unchanged.
- Proofs can be queued when selected but before the user presses Submit. A later iteration should queue only upon successful submission, with a persistent local proof record and image-to-challenge linkage.
- Failed uploads retry on reconnect, visibility return, or re-login, not on a timed backoff. Queue items persist on the device until uploaded.
- Account sign-out does not delete browser-local artwork. Avoid sharing devices until account-scoped local state is implemented.
- `schema.sql` includes owner-scoped RLS. Validate it in a real configured Supabase environment before release.
