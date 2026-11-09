# v1.5 test report

66 Node automated tests passed against the updated project modules. Eleven new weekly calendar and offline event tests cover Lisbon winter/summer Monday resets, both DST transitions, device vs account time zone, invalid inputs, delayed offline submission, expiry, future clock anomalies, retries, and independent events.

**Mutation check:** Deliberately shifted the weekday calculation by one day: the new tests failed. Restoring the implementation made them pass again. The UI module also passed `node --check`.

**Not verified:** browser end-to-end interactions, live Supabase integration, exactly-once cloud XP, client clock authenticity, account isolation, and two-device synchronization. The standalone app requires a local HTTP server because it imports an ES module.
