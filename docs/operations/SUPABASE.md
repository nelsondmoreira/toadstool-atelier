# Supabase setup and deployment status

**Status: not production-verified.** Current SQL schema and Edge Function source live in `backend/supabase/`. These are not proof of a deployed or secure backend.

Before enabling cloud accounts: create a dedicated Supabase project, review schema migrations and policies, configure email/Google redirect URLs, create a private artwork bucket, verify account-scoped object permissions, deploy Edge Functions, and exercise live end-to-end tests with two distinct users.

Never put a service-role key in Vite/browser variables. Keep secrets in Supabase-managed server configuration. Verify RLS for reads, writes and deletes; check account deletion and artwork cleanup with an isolated test project before production use.

Deployment instructions and actual environment variables will be documented after the product owner approves the deployment platform and backend configuration.
