# Local development

## Prerequisites
Node.js 22 LTS (or a compatible supported version), npm, Git and VS Code. Supabase credentials are **not** required for the local prototype and tests.

## Commands (current runnable prototype)
```sh
npm install
npm run dev
# Open the localhost URL shown by Vite
npm test
npm run build
```

The `dev` command starts the Vite frontend; it does **not** start a backend server. Authentication, cloud synchronization and storage require separately configured Supabase infrastructure. Do not mistake local demo behavior for deployed functionality.

## Environment and secrets
Do not commit `.env`, `.env.local`, API secrets, service-role keys or passphrases. Public browser configuration can use `VITE_`-prefixed keys only when safe to expose. Supabase service-role credentials must remain server-side.

## Troubleshooting
If `npm install` cannot reach the registry, retry with network access. If `npm run build` fails, capture the exact output before changing dependencies. Existing `node --test` tests run independently of Vite.
