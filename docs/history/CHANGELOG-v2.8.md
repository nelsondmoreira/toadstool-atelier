# v2.8 — Prevent artwork misattribution on account changes

The existing plaintext IndexedDB upload queue now captures the account at the beginning of image optimization and verifies it is still active before writing the image. It also rechecks proof-deletion tombstones after image decoding. This prevents a drawing selected under account A from being stored under account B if sign-out or account switching occurs while image decoding is in progress.

Two integration tests drive the real queue's enqueue method through asynchronous image decoding and IndexedDB transactions. Full test suite: 162 passed, 0 failed. Mutation experiment: disabling the new account-change guards makes both new regression tests fail; the original guards were restored and tests rerun.

**Still outstanding:** The active queue remains plaintext and is not yet connected to the encrypted vault pipeline. Browser and deployed Supabase verification remain pending. The remembered-unlock module is not wired into the UI. Do not interpret these tests as production end-to-end verification.
