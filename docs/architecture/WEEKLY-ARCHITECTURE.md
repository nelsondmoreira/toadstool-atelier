# Weekly calendar and offline completions (v1.5)

Account time zone is stored as an IANA name; calendar week IDs are Mondays in that zone. The standalone app now imports the shared pure calendar module and uses it to reset the current week. The quest completion handler checks the deadline before awarding XP and records an event identifier. The module provides validation and merge utilities for the future cloud event ledger.

## Important limitations
- The current app still persists its state in a browser-local JSON record. The event merge function is not wired to an atomic Supabase XP ledger. Cross-device XP exactly-once is NOT guaranteed.
- Client clock timestamps are untrusted. The chosen policy accepts recorded offline times with basic future-clock checks; backdating cannot be reliably prevented offline.
- The fixed time zone is initialized from the browser and persisted in local state; account profile synchronization and scheduled time-zone changes are not yet implemented.
- The current UI is now a JavaScript module and should be served over HTTP(S) (e.g. `python -m http.server`) rather than opened via `file://`.
- No live Supabase or real browser tests were run in this iteration.
