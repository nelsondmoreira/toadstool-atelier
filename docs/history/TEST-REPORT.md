# Pocket Art Helper — adversarial testing report

## Verified locally

- `npm test`: 54 passed, 0 failed (Node 22).
- New integration tests exercise the **real artwork queue** against an asynchronous IndexedDB test double and a controllable Supabase stub.
- Confirmed a genuine defect in v1.3: `transact()` always opened the `uploads` store, even when proof deletion requested `proof_deletions`. This prevented offline tombstones from persisting. Fixed in `cloud/artwork-queue.js`.
- **Mutation check:** restoring the original defective line makes all three new queue integration tests fail. The tests demonstrably detect the defect instead of passing unconditionally.
- Added adversarial storage-path validation for empty user IDs, empty segments, dot segments, traversal and backslashes.
- Tested offline tombstone persistence, successful reconnect cleanup and retained retry records on cloud RPC failure.

## Limitations / open risks

- The IndexedDB implementation in these tests is a focused asynchronous test double, **not a real browser**. Test on actual Chrome/Firefox/Safari, especially browser storage eviction, quota errors and tab closure mid-transaction.
- Supabase calls are stubbed; no live project is connected. Storage policies, account isolation, Edge Functions and concurrent device synchronization require deployment tests.
- Account deletion is not atomic across database and object storage. Partial deletion, pagination and concurrent uploads need integration tests with an isolated Supabase test project.
- Earlier tests include static code checks; they are not equivalent to behavioral tests. Do not interpret the aggregate pass count as production readiness.

## Run

`npm test`

