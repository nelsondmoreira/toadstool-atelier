# v2.5 — Actual HTTP-boundary artwork integration tests

Added `cloud/artwork-http-transport.mjs` and `cloud/artwork-http.e2e.test.mjs`.
Five end-to-end transport tests exercise real HTTP requests using Node's `fetch` against an ephemeral HTTP server, connecting the existing encrypted repository and vault upload pipeline to an authenticated upload/metadata API. They cover a complete upload, a 503 retry, wrong-account rejection, missing credentials, and incorrect vault passphrase. The server is an in-process **test implementation**, not Supabase. The test uses an in-memory repository adapter rather than browser IndexedDB; it does encrypt/decrypt actual bytes with Web Crypto. These tests do not establish deployed Supabase RLS correctness or UI wiring.

Test suite: `npm test` (151 passing). Mutation check: temporarily removed the test server's owner authorization and observed the cross-account test fail, then restored the guard and reran the suite.

Next steps: browser UI -> IndexedDB -> real Supabase SDK -> deployed RLS/storage tests, then replace the old plaintext queue. Do not consider vault cutover complete.
