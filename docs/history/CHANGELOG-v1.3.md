# v1.3 — Direct account deletion groundwork

- Signed-in account deletion panel with typed `DELETE` confirmation and cancel action.
- Authenticated Supabase Edge Function using a **server-only** service-role key.
- Deletes private artwork objects before deleting the auth user (database rows cascade via FK).
- Aborts user deletion if storage cleanup reports an error; retries may be necessary.
- Leaves browser-local data intact deliberately: legacy local data is not account-isolated, so clearing it automatically could erase another person's local progress.
- Unit tests cover confirmation, HTTP method, storage ownership, and abort-on-failure.

## Deployment and security

1. Configure the existing Supabase project, schema, and Auth providers.
2. Install the Supabase CLI, link the project, and deploy with `supabase functions deploy delete-account` (leave JWT verification **enabled**).
3. Ensure `SUPABASE_SERVICE_ROLE_KEY` is available only as a server-side function secret. Never put it in `cloud/config.js`.
4. Test using **disposable accounts**. Validate two-account isolation and deletion with >100 artwork files, nested paths, interrupted network, and partial failures.
5. Deletion is irreversible, but not atomic across Storage and Auth; partial storage deletion can occur before a failure. Production deployment requires a hardened, resumable cleanup worker and audit of all storage locations.
6. No live backend has been configured or tested in this package.

**Important:** Direct deletion does not include a backup/export step. No recovery period. Badge history is removed only when the entire account is deleted; deleting a proof drawing separately still retains the badge.
