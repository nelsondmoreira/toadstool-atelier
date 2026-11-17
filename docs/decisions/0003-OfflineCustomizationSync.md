# ADR-0003: Offline customization and synchronization

Status: Accepted product policy; implementation pending.

## Context

All local application features must work offline. Optional cloud
synchronization supports recovery and use across devices.

Upload completion order must not determine the selected customization.

## Decision

- Save each confirmed customization locally before attempting network work.
- Persist pending synchronization operations across application restarts.
- Identify each operation and record the versions it supersedes.
- For each customization slot, a later choice supersedes the choices
  it follows, regardless of device clock changes or upload order.
- Use version relationships to distinguish subsequent changes from
  independent changes made on different devices.
- Resolve independent changes using the recorded UTC timestamp.
  Break equal timestamps using a deterministic operation identifier order.
- Preserve conflicting alternatives so the user can select one later.
- Selecting an alternative creates a new operation.
- Replacing a customization does not delete its original library artwork.
- Retries reuse the original operation identity and metadata.
- Scope operations, assets and versions to their owner and customization slot.
- Apply equivalent conflict decisions locally and atomically on the server.
- Do not apply customization replacement rules to XP or achievements.

## Recovery and limitations

Only successfully synchronized data can be restored automatically
after local data loss or reinstallation.

Device clock inaccuracies can affect independent-change resolution.
They must not override known version relationships.

Synchronization runs when connectivity and application execution permit.
Immediate background execution is not guaranteed.

## Implementation constraints

Preserve existing data, encryption and account isolation.
Introduce no new dependencies under this decision.
Design backward-compatible migration before changing persisted formats.
Keep existing behavior available until replacement paths are verified.

## Verification required

Cover sequential choices with clock rollback, reversed upload order,
duplicate retries, independent changes, equal timestamps, alternative
selection, account isolation and preservation of referenced artwork.

Browser and server integration require separate verification.
