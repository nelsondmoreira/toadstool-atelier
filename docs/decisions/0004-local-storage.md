# ADR-0004: Local application storage

Status: Accepted architecture; implementation and verification in progress.

## Context

The first usable application cycle must support local image storage, gallery
references, customization, quest completion and skill XP without authentication
or network access. Existing data is split between localStorage and several
IndexedDB databases. Transactions cannot span separate IndexedDB databases.

## Decision

Use one main IndexedDB database named `toadstool-atelier`, with these stores:

| Store | Responsibility |
| --- | --- |
| `profiles` | Local identity and profile preferences. |
| `progression` | Skill XP, quest/mission completions and reward records. |
| `images` | Encrypted image content and technical metadata. |
| `galleryEntries` | References to local images or external URLs. |
| `atelierUnlocks` | Unlocked editing capabilities and proof references. |
| `customizations` | Selected image references and presentation settings per slot. |

- Store image content independently from the objects that use it. Multiple
  consumers may reference the same image without duplicating its bytes.
- Replacing a customization must not automatically delete its previous image.
- Separate unlock eligibility from the currently selected customization.
- Use customization slots for banners, profile pictures, backgrounds, app icons
  and badge icons; do not create a separate store for each visual component.
- Store external gallery links as references. Saving a URL does not make its
  remote content available offline.
- Group related writes in one transaction when atomicity is required. Sharing
  a database enables this but does not automatically make separate writes atomic.
- Prepare and encrypt image bytes before starting their write transaction.
- Preserve the existing encrypted image format and remembered-unlock mechanism.
- Place local persistence modules in `frontend/src/storage/`. This is the
  approved exception to the earlier target of putting IndexedDB adapters under
  `infrastructure/`.
- Introduce no new dependencies for this step.

Authentication and cloud integration are outside the initial local cycle and
must not be prerequisites for it. Frog's Secret is deferred; no dedicated
schema is selected until its behavior is defined.

## Gallery ordering

Approved local behavior; implementation and verification pending:

- Each gallery entry has a non-negative integer `position`, starting at zero,
  within its owner's gallery. Images and external links share the same order.
- Users can reorder entries. New entries are inserted at the beginning.
- Persist all affected positions in one read/write transaction so insertion
  or reordering cannot leave a partially updated order.
- Read the current order and write its changes in the same transaction to avoid
  overwriting concurrent local edits with a stale list.
- Preserve the saved order when the application is reopened offline.
- Position belongs to the gallery entry, not its referenced image.
- Persist `position` on each entry. For the initial cycle, load the owner's
  gallery entries and sort them in memory; do not add a position index.
- Adding this object property alone does not require a database version change.
  Assign positions to legacy entries during migration, preserving their existing
  order. Creating an index later would require a schema upgrade.
- Cross-device ordering conflict resolution is deferred; customization conflict
  rules do not automatically define gallery ordering behavior.

## Alternatives considered

Keeping independent databases requires recovery or compensating operations
for writes that must stay consistent across database boundaries. A single
generic state object minimizes initial changes but mixes progression, gallery,
unlock and customization responsibilities. The selected stores separate those
responsibilities while allowing shared transactions.

## Migration and verification

Preserve existing data and account isolation. Copy and verify data before
switching readers and writers; do not automatically delete source records.
Do not silently associate existing cloud-account data with a local profile.

Schema creation is only the first step. Profile initialization, application
integration, migration, transactional workflows and offline startup require
implementation and verification. No complete offline cycle or browser test
pass is claimed by this decision.

Verify interrupted writes, duplicate completion attempts, image-reference
integrity, failed migrations and reopening without network access. Follow
ADR-0003 when customization synchronization is implemented later.

Gallery verification must cover mixed image/link reordering, insertion at the
beginning, persistence after reopening, transaction rollback on failure and
concurrent local edits.
