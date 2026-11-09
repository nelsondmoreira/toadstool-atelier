# v0.6 — safe artwork replacement foundation

The `replace-design.mjs` module specifies the order of operations for a future Supabase adapter: stage locally, upload a new unique object, atomically change the active slot pointer, then schedule/delete the old object. It deliberately does not overwrite existing files. Failed cleanup is retried independently; retry must check the old path is not referenced by any active slot. Proof drawings are not subject to design replacement.

**Integration status:** This is a tested domain-level module, not yet wired to the HTML badge editor or a live Supabase adapter. The existing HTML editor continues to save custom designs locally. The database schema adds private design pointers and cleanup jobs. Production integration must use a transaction/RPC for the pointer update and cleanup-job insertion to avoid a crash between these two steps, enforce one active design per slot, and check owner authorization on the server. It must also persist staged files in IndexedDB and handle cross-device concurrent edits with compare-and-swap revisions. Never embed service-role credentials in the browser.

Run: `node --test cloud/replace-design.test.mjs` from the project directory.
