# v0.4 Offline progress sync (development preview)

## Setup
1. Serve the project from a local HTTP server, not `file://` (e.g. `python -m http.server 8000`).
2. Create a Supabase project and run `cloud/schema.sql` in its SQL editor.
3. Copy `cloud/config.example.js` to `cloud/config.js` and enter the project URL and **publishable** key (never a service-role key).
4. Configure email and Google sign-in and authorized redirect URLs in Supabase Auth.
5. Open the app and sign in. Online progress writes to the `artist_profiles` row; offline changes queue in browser storage and retry on reconnect.

## Current limitations and next work
- This is a development preview, not production-ready synchronization. The JSON state is a last-write snapshot; concurrent editing from multiple devices is not transactionally safe. Per-action event IDs and a server-side merge are needed before multi-device production use.
- The current merge preserves higher XP and unioned completions but may not preserve every cross-device reroll correctly. It also cannot properly reconcile prestige resets; do not rely on cross-device prestige until event-based synchronization is built.
- **Artwork does not sync yet**. Large embedded image data is excluded from database snapshots. Upload images into the private `artist-artwork` bucket, store object paths in records, and use signed URLs for reading. Do not store base64 blobs in JSON.
- Local storage is not user-isolated. Do not use shared devices or switch between accounts in this preview. Account-scoped local databases and a first-login migration choice are required.
- Offline support here is for locally cached app state. Installable PWA/offline app-shell caching and IndexedDB artwork storage are future work.
- Cloud functionality requires a configured Supabase project and a web server; it cannot work from a single downloaded HTML file.
