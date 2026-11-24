# GitHub Pages operations

Status: local implementation present; the user reported passing `npm run check`
and `npm run test:browser`. First live publication remains unverified.
Remote deployment requires committing and pushing
the workflow/scripts to `main`. No publication has been performed by the assistant.

See [ADR-0005](../decisions/0005-github-pages.md) for behavior and constraints.

## Prerequisites

- Repository: `nelsondmoreira/toadstool-atelier`, default branch `main`.
- GitHub CLI installed and authenticated as a user authorized to manage Pages,
  workflows and the deployment controls. Never paste authentication tokens in chat.
- GitHub Actions and Pages available for the repository.
- Local tests and production build checked by the user.

For GitHub CLI authentication, run `gh auth login --hostname github.com` if needed.
The authenticated user needs repository administration and token permissions for
Pages/administration, Actions and repository variables. Insufficient token scopes
must be corrected by the user; do not paste tokens into chat or commit them.
The scripts target this repository explicitly, regardless of the current branch.

## Target commands

```powershell
npm run deploy -- on
npm run deploy -- on --fast
npm run deploy -- on --once
npm run deploy -- on --once --fast
npm run deploy -- pause
npm run deploy -- off
npm run deploy -- status
```

`on` publishes and enables automatic deployment; `--once` leaves automatic
deployment paused. Tests are required unless `--fast` is explicitly selected.
`pause` retains the published site; `off` unpublishes it. These commands never
commit or push local files. The source to publish is remote `main`.

`pause` and `off` also cancel pending/in-progress runs of the dedicated Pages
workflow, waiting for completion before reporting success. Ordinary CI stays
enabled. If cancellation fails or times out, the command reports an error and
does not claim unpublication. For `off`, retry after inspecting the active runs.

`on` returns after GitHub accepts the request, not after the site is published.
Use `status` and the displayed Actions link to inspect the outcome. `status`
shows the configured site, workflow state and latest run; it is not a public
HTTP availability check. After `off`, cached copies may still be accessible.

The first checked deployment may take longer while browser dependencies install.
The existing CI and Pages checks are independent; checked Pages publication
repeats relevant tests, whereas fast publication does not wait for CI results.

## Files and responsibilities

- `scripts/deployment-control.mjs`: command validation, authorization policy and
  activation/pause/unpublish sequencing.
- `scripts/github-pages-api.mjs`: GitHub CLI transport, fixed repository target
  and GitHub Pages/Actions/variables API operations. Uses existing CLI login.
- `scripts/deploy.mjs`: terminal entry point and clear requested/confirmed status.
- `.github/workflows/pages.yml`: checked/fast builds, artifact upload and publication.
- `.github/workflows/ci.yml`: existing independent Node/build checks, now using
  `npm ci` for lockfile-based installation.
- `vite.config.js`: Pages asset base enabled only for the Pages build.

No additional npm dependency or stored personal access token was introduced.
The deployment job uses GitHub's scoped `GITHUB_TOKEN` and OIDC permissions.

## Before the first activation

Run the local checks yourself:

```powershell
npm run deploy -- --help
npm run check
npm run test:browser
```

The help command is offline and makes no GitHub requests. Node tests cover the
policy and API failure paths using controlled API/CLI collaborators; they do not
activate Pages. Static workflow checks inspect wiring without running Actions.

Review and commit the setup, then push it to remote `main`. Adding these files
alone does not authorize publication: absent deployment controls deny the Pages
publish job. The workflow may still start a skipped planning run on push.

After the workflow is registered remotely, inspect status and explicitly activate:

```powershell
npm run deploy -- status
npm run deploy -- on --once
```

The suggested first activation is checked and one-shot, leaving automation paused.
It configures Pages for Actions through the API, so the account must have the
required administration rights. If GitHub requires environment/organization
approval, follow the linked Actions run rather than reporting the site as online.

Verify the actual URL, images/styles and navigation after a successful run.
Only after that verification select persistent `on`, `pause` or `off` as needed.
Deployment failures do not prove an application defect; distinguish credentials,
Pages configuration, test failures and build/runtime problems.

The local implementation and documentation do not change remote settings.
Only executing the mutating deploy commands performs those operations.

## Production suitability and portability

GitHub Pages serves static frontend files; server-side services, if introduced,
need separate hosting. Its usage limits and restrictions must be reviewed before
choosing it for an official release, especially a commercial product:
https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

The Vite build and tests are reusable on another static hosting platform. Pages
permissions, publishing/unpublishing APIs and deployment actions are provider
specific and require adaptation. The approved command interface does not mean
that its underlying hosting operations are automatically portable.

Changing origin (scheme, hostname or port) also changes the local browser-storage
scope. A future hosting/domain move needs an explicit data export/import or
migration plan; deployment automation alone cannot move existing IndexedDB data.

Preview-versus-production environments, a stable production domain, rollback
policy and production fast-mode restrictions have not been selected. These
require owner decisions before implementing them.

## Initial asset-path check

The proposed Vite configuration selects the project base when
`GITHUB_PAGES=true`. In a PowerShell terminal, build with:

```powershell
$previousPagesValue = $env:GITHUB_PAGES
try {
  $env:GITHUB_PAGES = 'true'
  npm run build
} finally {
  $env:GITHUB_PAGES = $previousPagesValue
}
```

Inspect `dist/index.html` and confirm that generated script and stylesheet URLs
start with `/toadstool-atelier/assets/`. This verifies an asset-path prerequisite,
not actual deployment, full runtime behavior or offline startup.
