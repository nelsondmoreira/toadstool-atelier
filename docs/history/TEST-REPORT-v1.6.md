# v1.6 honest test report

`npm test`: 77 passing, 0 failing on Node 22.

New ledger cases exercise optimistic immediate XP, duplicate tap, same mission from two offline devices, distinct missions merging, repeated acknowledgement, rejection rollback in the ledger projection, retry after network failure, prestige cycle isolation, invalid XP, and malformed event IDs.

Mutation check: disabled the duplicate-event guard in the actual ledger implementation; the test suite failed (see `MUTATION-RESULT.txt`). Restored guard afterward.

**Not implemented or verified:** No live Supabase atomic XP ledger; no actual sync acknowledgements or rollback wired into the UI; pending XP events remain pending. No two-browser end-to-end test, quota-exhaustion test, or real mobile tests. The current UI still has legacy XP counters and localStorage, so an eventual server reconciliation must migrate these and handle rejection safely. The UI now avoids removing earned XP when tapping a completed mission, and uses the new ledger for duplicate protection on new completions.

**Known limitation:** The browser demo is not production-safe against cross-device double awards. Server-side unique constraints and transactional XP calculation are required before launch.
