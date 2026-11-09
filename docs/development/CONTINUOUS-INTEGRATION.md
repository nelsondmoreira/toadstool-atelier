# Continuous integration

The repository uses [GitHub Actions](../../.github/workflows/ci.yml) to check pull requests and pushes to `main`.

## Checks

The **Test and build** job uses Node.js 22, installs dependencies, runs `npm test`, and runs `npm run build`. A failing command fails the job. CI does **not** deploy the app, run browser tests, or verify live Supabase services.

## Local verification

```sh
npm install
npm test
npm run build
```

## Reproducibility limitation

The repository currently has no committed `package-lock.json`, so CI temporarily uses `npm install`. Generate and commit the lockfile after confirming the dependency resolution locally; then change the workflow to `npm ci`. Do not claim fully reproducible builds until that is done.

## Pull request policy

Open a pull request from a short-lived branch. Require the **Test and build** status check for `main` where GitHub repository settings permit. Do not merge failing changes. Review any changes to workflows, permissions, secrets, or dependencies carefully.

## Future additions

Add browser end-to-end checks and deployment only after the required tools and deployment architecture are approved and implemented.
