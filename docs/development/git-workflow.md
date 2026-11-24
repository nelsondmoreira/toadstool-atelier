# Branching and commit conventions

This guide consolidates the repository's GitHub Flow rules and provides a
repeatable commit procedure. Commits are always performed manually by the user.
Requests such as "let's commit" ask the assistant to review and provide commands,
not execute staging or commits. Commands below also do not authorize an assistant
to create/switch branches or push.

## Branches

- `main` is the stable integration branch.
- Use short-lived branches for one coherent objective. Do not add a permanent
  `develop` branch or separate long-lived branches for each application layer.
- Name branches `<type>/<short-kebab-case-description>`.
- Keep branch names and commit messages in English.
- Open a pull request, review the diff and required checks, and merge only when
  the change is ready. Delete the working branch after integration.

| Type | Purpose | Example |
| --- | --- | --- |
| `feat` | New capability or a new functional foundation. | `feat/offline-gallery` |
| `fix` | Correction of an existing defect. | `fix/duplicate-quest-xp` |
| `refactor` | Restructuring without intended behavior changes. | `refactor/centralize-tests` |
| `docs` | Documentation-only work. | `docs/local-storage-design` |
| `test` | Test coverage changes. | `test/profile-transaction-recovery` |
| `chore` | Tooling or maintenance. | `chore/playwright-setup` |

Choose the branch type for its main objective; individual commits can use
different types. A branch may span storage, UI, tests and documentation when
they serve the same objective. Avoid unrelated cleanup in the same branch.

For new work, begin from a clean, current `main`. For work already present in
a dirty working tree, inspect it before updating or switching branches. Do not
pull into it blindly, discard changes or use an automatic stash as a substitute
for understanding the state. Creating a branch from the current checkout is
an option for the user, but does not update it with remote changes.

## Commit messages

Use:

```text
<type>(<scope>): <imperative description>

Optional explanation of the reason, constraints or migration consequences.

Optional verification commands, results and known limitations.
```

- Use the branch types above for commits as well.
- Scope is optional. Use a stable affected domain such as `storage`, `gallery`,
  `atelier`, `progression`, `customization`, `testing` or `docs`.
- Describe the actual change, not a future capability. Prefer `add`, `preserve`,
  `prevent`, `move` or `document` over `updates` or `changes`.
- Keep the subject concise, preferably at most 72 characters, without a final
  period. Use a body when the subject cannot explain an important constraint.
- Use one type per message, not `fix + docs`. Include related tests and
  documentation in the same logical change; that does not require multiple types.
- Avoid messages such as `WIP`, `final`, `misc fixes` or `make tests pass`.
- Do not describe infrastructure foundations as a completed product feature.

Examples:

```text
feat(storage): add local profile persistence foundations
fix(progression): prevent duplicate quest rewards
refactor(testing): centralize tests by verification level
test(storage): verify rollback after profile creation aborts
docs(git): document branching and commit conventions
```

## Commit boundaries and staging

One commit should express one reviewable reason for changing the repository.
Keep source, regression tests, required configuration and behavior documentation
together. Do not split a move from the import/path/script changes it requires.
Commit `package.json` and its corresponding lockfile together when dependencies
change. Keep unrelated formatting and renames out of functional changes.

Before each commit:

```powershell
git status --short
git diff
# Stage explicit paths; use git add -p when a file contains unrelated changes.
git diff --cached --stat
git diff --cached --check
git diff --cached
```

Review staged additions and deletions together: Git may display relocated files
as deletions plus untracked additions before staging. Do not use `git add .`
without reviewing everything it would include. Do not stage credentials, private
images, database files, dependencies or generated reports/build output.

Run checks appropriate to the change. For the current combined storage/testing
work, the relevant commands are:

```powershell
npm run check
npm run test:browser
```

The user executes suites under the guided workflow. Record user-reported results
as such. Passing checks validate the working tree that was tested, not necessarily
each intermediate staged commit. When a series must provide independently green
checkpoints, verify the intermediate trees in isolation. Do not manufacture a
fine-grained history by claiming untested checkpoints passed.

If changes cannot be separated into coherent intermediate commits without
breaking required paths or setup, prefer one honest cohesive commit over a
broken sequence. Test counts alone are not evidence of feature correctness.

## Suggested split for the current foundation work

These are grouping recommendations, not executed commits:

1. `feat(storage): add local profile persistence foundations`
   - Local database schema and profile repository, legacy profile helper and its
     retained unit coverage, and ADR-0004. These modules are not yet the complete
     integrated offline application.
2. `feat(customization): compare customization version vectors`
   - Version-comparison module and its unit tests. This does not implement cloud
     synchronization or change the active customization flow.
3. `refactor(testing): centralize suites and automate browser checks`
   - Existing test relocations, updated imports/source paths, Playwright integration
     checks, Node discovery script, package/lockfile, configuration and the matching
     testing/architecture documentation. Include both sides of every move.
4. `docs(git): document branching and commit conventions`
   - This guide, contribution conventions and the documentation index. Use partial
     staging if a shared document includes changes belonging to earlier groups.

The existing user-reported successful checks cover the final combined state.
They are not proof that each suggested intermediate commit is independently green.
The documentation index and shared guides may require partial staging to keep
references consistent with the files introduced in each commit.

## Pull requests and avoiding conflicts

- Keep branches short-lived and avoid editing the same files across parallel work.
- Agree who owns shared schema, configuration and lockfile changes when several
  people work concurrently. Avoid broad renames during an unrelated feature.
- Before review, describe the problem, resulting behavior, verification and any
  migration or recovery limitations. Review generated lockfile changes too.
- Integrating changes from `main` requires a clean, understood working tree.
  Inspect conflicts and resolve them deliberately; do not blindly keep one side
  of schema, encryption or lockfile changes. Re-run affected checks afterwards.
- A merge-versus-rebase policy and squash/merge strategy are not selected by this
  guide. Agree them explicitly before rewriting or integrating branch history.
- Do not force-push, rewrite published history or reset work without explicit
  authorization. Commits remain manual. Branch operations and pushes on the
  user's behalf require their own explicit authorization.
