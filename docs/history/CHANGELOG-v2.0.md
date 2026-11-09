# v2.0 — account-scoped local state (security and correctness milestone)

- Introduced account-specific localStorage keys; guest state has a separate namespace.
- Account switch synchronously swaps visible progress, gallery, badge proofs and customization; closes open badge detail dialogs.
- No automatic migration of the old shared demo snapshot into a signed-in account. The legacy snapshot remains intact for a future explicit import flow.
- Completion sync reads the active account's key and includes the account identifier in reconciliation events, so stale responses from a previous account cannot alter the currently visible account.
- Disabled the old full-profile snapshot synchronization path because its max-XP merge could override server-authoritative reconciliation and its shared key could leak account data.
- Added seven account-isolation, corruption and quota regression tests.

## Important remaining limitations

- No production authentication/browser integration test has run against Supabase.
- The previous legacy demo snapshot is preserved but not automatically displayed or imported.
- Existing account-scoped localStorage is not encrypted at rest; shared devices and browser extensions remain a privacy risk. Sign-out hides account data in the UI but does not wipe browser storage, as requested.
- Private artwork is queued for upload but not yet restored from cloud storage on another device.
- Account-profile cloud snapshots are intentionally paused until a safe server-authoritative merge is implemented.
- A browser-local storage quota failure may still prevent saving large inline images; artwork must migrate fully to IndexedDB.
