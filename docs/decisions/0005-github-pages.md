# ADR-0005: GitHub Pages deployment controls

Status: Accepted; local checks and the first checked one-shot publication reported successful by the user. Remaining live deployment modes require verification.

## Context

The owner selected GitHub Pages for the frontend and requested short terminal
commands for automatic deployment, explicit fast deployment, pausing publication,
unpublishing and status inspection. The owner authorized implementation of this
Pages setup; the assistant must not commit, push or publish without authority.

## Approved interface

Use one npm entry point: `npm run deploy -- <action> [options]`.

| Action | Effect |
| --- | --- |
| `on` | Publish remote `main` with tests and enable subsequent automatic deployments. |
| `on --fast` | Publish remote `main` and enable automatic deployments without a test gate. |
| `on --once` | Publish once with tests, leaving automatic deployments paused. |
| `on --once --fast` | Publish once without tests, leaving automatic deployments paused. |
| `pause` | Pause future deployments while retaining the currently published site. |
| `off` | Pause deployments and unpublish the Pages site. |
| `status` | Read site and deployment-control status without mutation. |

The CLI and deployment policy live in `scripts/`; the dedicated Actions workflow
is `.github/workflows/pages.yml`. The `PAGES_DEPLOY_CONTROL` repository variable
stores a versioned control object: automatic mode and an authorized manual request
identifier/mode. Missing controls default to off. New commands invalidate older
manual requests. Manual requests target remote `main` and require matching control
metadata; `--once` leaves the automatic mode paused rather than disabling the
workflow before the manual run can execute.

The dedicated workflow preserves ordinary CI independently of deployment mode.
Checked Pages runs repeat Node/browser verification; fast Pages runs do not wait
for ordinary CI. Pages builds once for its own artifact; CI may build separately.
Sharing CI artifacts is not implemented in this initial demo setup.

`--fast` and `--once` apply only to `on`. Reject unknown actions and unsupported
flags before remote mutations. Tests are the default; the fast path is explicit
and still requires dependency installation and a successful build. Preserve
ordinary CI checks rather than deleting or weakening tests for a fast deployment.

## Hosting and execution constraints

- Target `nelsondmoreira/toadstool-atelier`, branch `main`.
- Expected project URL: `https://nelsondmoreira.github.io/toadstool-atelier/`.
- Publish the Vite output in `dist/`, using `/toadstool-atelier/` as the Pages
  asset base. Preserve the existing local development and browser-test base.
- Use GitHub Actions for builds and deployment, and the installed GitHub CLI
  for terminal controls. No additional application runtime dependency is needed.
- Commands operate on committed remote `main`, not uncommitted local files.
- Commands must not create commits, switch branches or push changes.
- Do not enable automatic publication merely by adding the configuration files.
  An explicit activation step is required.
- Build once per deployment and publish that artifact. Changes arriving during
  a run must not cause the deployed artifact to differ from the checked source.
- Report queued work separately from successful publication. Surface API,
  authentication, workflow and deployment failures without claiming success.

## State, races and limitations

Pausing publication is distinct from unpublishing. Implementation must account
for queued/in-progress deployments and partial API failures, especially when
turning the site off. Do not report an unpublished state solely because a local
process exited successfully or a configuration variable changed.

`pause` and `off` clear request authorization, disable the dedicated Pages
workflow, cancel its active/queued/waiting runs and poll for completion. They do
not disable ordinary CI. `off` deletes Pages configuration only after runs have
stopped and verifies that the configuration is absent. Errors and cancellation
timeouts stop the operation and report possible partial state; they do not
pretend that a public site has disappeared. Retrying pause/off is supported.

Only publication jobs share cancelling concurrency; skipped push plans must not
cancel a one-shot publication. Before publication, the workflow rejects a build
whose revision has already been superseded on remote `main`. This is not an
atomic lock on future repository changes. Serialize administrative commands;
simultaneous operators changing controls/settings are outside this guarantee.

Changing repository visibility, introducing custom domains, adding deployment
credentials or selecting additional hosting services requires separate approval.
The repository was verified public when recording this decision.

Unpublishing does not erase users' browser data, revoke already downloaded
copies or disable an application prepared for offline operation. CDN/browser
caches may delay visible removal. Hosting does not implement offline startup,
storage migration or responsive layout improvements.

## Verification

Before live use, verify command validation, default test gating, explicit fast
mode, one-shot behavior, paused/off publication prevention, API errors and
in-progress run handling. Verify built asset paths and the deployed frontend.
Do not equate simulated CLI tests with actual Pages deployment verification.

## Sources

- https://vite.dev/guide/static-deploy
- https://docs.github.com/en/rest/pages/pages
- https://cli.github.com/manual/gh_variable_set
