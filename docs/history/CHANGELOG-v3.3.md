# v3.3 — Atelier badge design encryption

- New Atelier badge designs now persist in the encrypted gallery vault, not as plaintext data URLs in account JSON.
- Design confirmation verifies encrypted readback before changing the equipped reference. If encryption fails, the old design stays equipped.
- Badge and editor image elements resolve encrypted references with account-switch checks.
- On gallery vault readiness, legacy Atelier badge designs are copied into the encrypted repository and verified before replacing plaintext references. Failures retain the original data.
- The previous encrypted design is deleted only after a new design has been confirmed; cleanup failure is logged for follow-up.
- Added wiring regression tests for ordering and account guards. These tests inspect application code, not actual browser clicks; browser and Supabase E2E remain unverified.

Known gaps: legacy quest and Atelier proof migration, persisted cleanup retry for orphaned custom designs, live cloud recovery, and browser end-to-end tests.
