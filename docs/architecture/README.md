# Pocket Art Helper — cloud authentication (v0.3)

## Implemented
- Email one-time-password/magic-link authentication via Supabase Auth.
- Google OAuth via Supabase Auth.
- Persistent Supabase browser sessions, auth-state display, and sign-out.
- No passwords or private API keys stored in the project.
- Existing local art/progress remains untouched when signing in or out.

**Not implemented yet:** profile state synchronization, cross-device drawing access, artwork migration, and image storage. The UI explicitly labels progress as local. Do not describe this version as cloud-synced.

## Setup
1. Create a Supabase project at https://supabase.com and copy its **Project URL** and **publishable key** (or legacy anon key).
2. Copy `cloud/config.example.js` to `cloud/config.js`, and fill in the two values. Never use the service-role or secret key in frontend files.
3. In Supabase Authentication > Providers, enable Email and Google. For Google, configure a Google Cloud OAuth client with the Supabase callback URL provided by Supabase. Add your site's URL to Supabase Auth URL configuration / allowed redirect URLs.
4. Run `cloud/schema.sql` in the Supabase SQL editor (the storage policy schema is groundwork for a future release).
5. Serve the **project folder** over HTTP(S), e.g. `python -m http.server 8000` from the folder, then visit `http://localhost:8000`. Do not open the HTML with `file://`; ES modules and OAuth callbacks require a web origin.
6. Add your local development URL (e.g. `http://localhost:8000/**`) and production origin to Supabase Auth allowed redirect URLs. Google OAuth must also be configured as instructed by Supabase.
7. Test email sign-in, Google sign-in, sign-out and session restoration. A live internet connection is required to load the official Supabase JS client from esm.sh.

## Next architecture step
Decide whether proof/gallery images should be private by default and whether to upload them automatically or only on submission. The recommended approach is a private per-user storage bucket, with immutable proof references, replaceable custom-design slots, signed URLs for display, and an explicit first-time migration of local artwork.

## Security notes
The SQL enables row-level security. Authentication alone does not provide cross-device syncing. Do not put auth tokens or user-uploaded image contents in logs. Do not store private images in a public bucket. Validate uploaded MIME types and sizes server-side via bucket restrictions. Test access denial between two separate accounts before enabling syncing.

## v0.8 image optimization

See `IMAGE-OPTIMIZATION.md`. New queued artwork is optimized before being stored in IndexedDB. Run the policy, replacement and conflict tests with `node --test cloud/*.test.mjs` from the project root. The legacy HTML local image preview remains limited to 2MB and is not yet migrated to IndexedDB.
