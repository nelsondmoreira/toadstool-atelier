// Deploy with `supabase functions deploy delete-account` (JWT verification enabled).
// SUPABASE_SERVICE_ROLE_KEY is an Edge Function secret, NEVER a browser value.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { validateDeletionRequest, isOwnedPath, shouldDeleteAccount } from '../../../cloud/account-deletion-policy.mjs';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ error: 'Not supported' }, 405);
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in required.' }, 401);
  let body: { confirmation?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const invalid = validateDeletionRequest(req.method, body.confirmation);
  if (invalid) return json({ error: invalid.error }, invalid.status);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server is not configured.' }, 503);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: identity, error: authError } = await admin.auth.getUser(authorization.slice(7));
  if (authError || !identity.user) return json({ error: 'Invalid session.' }, 401);
  const userId = identity.user.id;

  // Delete Storage objects before deleting auth.users, because DB rows cascade.
  // A failure aborts account deletion, allowing safe retry. This is not an atomic
  // transaction: already removed objects cannot be recovered on partial failure.
  const failures: string[] = [];
  const bucket = admin.storage.from('artist-artwork');
  const pending = [`${userId}`];
  const paths: string[] = [];
  let traversed = 0;
  // Enumerate before deleting, using pagination so nested folders and >100 files
  // cannot be silently skipped. Do not delete the account on listing errors.
  while (pending.length && !failures.length) {
    const folder = pending.pop()!;
    if (++traversed > 10000) { failures.push('Too many folders'); break; }
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await bucket.list(folder, { limit: 100, offset });
      if (error) { failures.push('Could not list artwork'); break; }
      if (!data?.length) break;
      for (const item of data) {
        const path = `${folder}/${item.name}`;
        if (!isOwnedPath(userId, path)) { failures.push('Unsafe storage path'); break; }
        if (item.id == null) pending.push(path);
        else paths.push(path);
      }
      if (failures.length || data.length < 100) break;
      if (paths.length > 100000) { failures.push('Too many files'); break; }
    }
  }
  if (!failures.length) {
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await bucket.remove(paths.slice(i, i + 100));
      if (error) { failures.push('Could not delete artwork'); break; }
    }
  }
  if (!shouldDeleteAccount(failures)) return json({ error: 'Artwork cleanup was interrupted. Your account was not deleted; please retry.' }, 503);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: 'Account deletion failed. Please retry.' }, 503);
  return json({ deleted: true });
});
