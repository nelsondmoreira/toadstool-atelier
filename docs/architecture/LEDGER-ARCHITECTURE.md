# XP event ledger: design for production

The UI records a deterministic event ID (`mission:<weekKey>:<slot>` or `quest:<weekKey>:<questIndex>`), completion time, prestige cycle, XP and skill. An event is immediately displayed as pending and adds optimistic XP.

The backend MUST authenticate user identity, validate assignment/week, and atomically insert an event with UNIQUE(user_id,event_id), updating aggregate XP only if the insert succeeds. Retry returns existing event status without awarding twice. The backend should return confirmed/rejected IDs; the client should derive totals from the confirmed+pending event set and undo optimistic XP for rejected events. Never rely on localStorage or client-supplied XP as authority.

An offline event can be accepted under the agreed trust policy but remains unverified for true wall-clock time; obvious future timestamps are rejected. Timezone and assignment should be fixed server-side. Concurrent prestige changes require a server-authoritative cycle identifier, not only a local integer.

On sign-out, keep pending events in account-scoped storage, hide private content, and resume only when the same account signs in again. LocalStorage in the current demo is not account-scoped; do not ship it as cloud sync.
