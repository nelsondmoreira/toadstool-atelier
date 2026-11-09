# Private Offline Vault: security design and deployment gate

Status: **crypto foundation and staged migration helper only**. The app still writes plaintext account state and image data URLs. Do not describe current local data as encrypted.

## Threat model

Protects at-rest encrypted blobs from casual filesystem inspection, browser profile copying, or access to local storage without the unlock passphrase. Uses per-envelope random salt, PBKDF2-SHA256 (310,000 iterations), AES-256-GCM with random 96-bit nonce, authenticated account ID, and Web Crypto. It does **not** defend against XSS, malicious browser extensions, malware, keylogging, compromised unlocked sessions, or weak/reused passphrases. Browser storage encryption is not a substitute for full-disk encryption or device lock.

## Safe rollout before enabling encryption

1. Move large images from JSON/localStorage into account-partitioned IndexedDB blobs; never place sensitive image URLs in plaintext caches, thumbnails, service-worker caches or logs.
2. Add opt-in vault setup, passphrase confirmation, and clear recovery warnings. Never persist passphrase or unwrapped encryption keys. Unlock in memory per session, lock on sign-out and account change. A password manager can remember the passphrase, but the app should not.
3. Encrypt and authenticate each IndexedDB record using stable account-scoped IDs as additional authenticated data; use new random nonces for every write. Consider nonextractable in-memory key caching while unlocked to avoid PBKDF2 per image.
4. Migration: retain old plaintext until encrypted read-back and cloud backup verified. Explicitly request permission to delete legacy plaintext; note browser deletion cannot guarantee physical secure erasure on SSDs. Interrupted migration must be resumable and idempotent.
5. Signing in does not automatically unlock an offline vault. Cloud recovery is possible only for data already successfully synced. Never promise recovery of an offline-only drawing if its passphrase is lost.
6. Keep XP and completion sync working with the vault locked only if those event queues are explicitly separated and contain no sensitive artwork or proof. Otherwise require unlock for sync; avoid silently exposing drawings.
7. Run actual browser tests (Chrome/Safari mobile) for IndexedDB quota, background termination, low memory, wrong passphrase, cross-account, simultaneous tabs, interrupted migration, offline sign-out, and re-login. Add CSP, dependency pinning and XSS review.

## Deployment blocker

`private-vault.mjs` is currently **not integrated** into `index.html` or `artwork-queue.js`. Existing data remains unencrypted. Do not delete legacy local data until the UI, migration, and recovery behavior are tested end-to-end.
