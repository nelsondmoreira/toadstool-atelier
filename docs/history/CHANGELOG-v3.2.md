# v3.2 — Quest and Atelier proof vault references

- New quest proof and Atelier challenge proof submissions use encrypted IndexedDB artwork storage, with `vault:<id>` references in progress state instead of base64 image bytes.
- Badge detail's opt-in View drawing resolves the encrypted reference asynchronously, guarding against account changes while loading.
- Permanent proof deletion removes encrypted bytes before deleting the progress reference; failed deletion preserves the proof reference for retry.
- The Atelier proof opener resolves encrypted artwork references.
- Gallery vault gains explicit account-scoped orphan cleanup after account changes.
- Added four tests (three app-wiring checks and one encrypted repository integration test); total 184 passing.

## Known gaps

- Legacy plaintext quest/Atelier proofs are still readable but have not been migrated.
- Atelier custom badge designs still store plaintext base64 in application state.
- No real-browser or live Supabase integration has been demonstrated for this release.
- Browser source-wiring tests assert call paths but are not substitutes for click-driven end-to-end tests.
