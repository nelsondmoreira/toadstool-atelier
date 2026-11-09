-- Pocket Art Helper: Supabase PostgreSQL starter schema
-- Run in a Supabase project's SQL editor after enabling Auth.
create extension if not exists pgcrypto;
create table if not exists public.artist_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.artist_profiles enable row level security;
create policy "read own profile" on public.artist_profiles for select to authenticated using (auth.uid() = user_id);
create policy "create own profile" on public.artist_profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "update own profile" on public.artist_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Private artwork bucket; upload paths should begin with the authenticated user's UUID.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('artist-artwork','artist-artwork',false,10485760,array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
create policy "read own artwork" on storage.objects for select to authenticated using (bucket_id='artist-artwork' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "upload own artwork" on storage.objects for insert to authenticated with check (bucket_id='artist-artwork' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own artwork" on storage.objects for update to authenticated using (bucket_id='artist-artwork' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id='artist-artwork' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own artwork" on storage.objects for delete to authenticated using (bucket_id='artist-artwork' and (storage.foldername(name))[1] = auth.uid()::text);

-- v0.5: metadata only; original image bytes stay in the private Storage bucket.
create table if not exists public.artwork_assets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('inspiration','quest-proof','atelier-proof','atelier-design')),
  slot text,
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now(),
  unique(user_id,id)
);
alter table public.artwork_assets enable row level security;
create policy "read own asset metadata" on public.artwork_assets for select to authenticated using (auth.uid()=user_id);
create policy "insert own asset metadata" on public.artwork_assets for insert to authenticated with check (auth.uid()=user_id and storage_path like auth.uid()::text || '/%');
create policy "delete own asset metadata" on public.artwork_assets for delete to authenticated using (auth.uid()=user_id);

-- v0.6: custom-design pointers and deferred deletion jobs.
-- Keep proof artwork separate from customizable design assets.
create table if not exists public.atelier_design_slots (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null,
  storage_path text not null,
  operation_id uuid not null,
  crop jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(user_id,slot),
  check (storage_path like user_id::text || '/atelier-design/%')
);
alter table public.atelier_design_slots enable row level security;
create policy "read own design slots" on public.atelier_design_slots for select to authenticated using (auth.uid()=user_id);
create policy "insert own design slots" on public.atelier_design_slots for insert to authenticated with check (auth.uid()=user_id);
create policy "update own design slots" on public.atelier_design_slots for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create table if not exists public.artwork_cleanup_jobs (
  operation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  old_path text not null,
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  check (old_path like user_id::text || '/%')
);
alter table public.artwork_cleanup_jobs enable row level security;
create policy "read own cleanup jobs" on public.artwork_cleanup_jobs for select to authenticated using (auth.uid()=user_id);
create policy "insert own cleanup jobs" on public.artwork_cleanup_jobs for insert to authenticated with check (auth.uid()=user_id);
create policy "delete own cleanup jobs" on public.artwork_cleanup_jobs for delete to authenticated using (auth.uid()=user_id);

-- v0.7: ordering metadata for offline edits; timestamps reflect user confirmation,
-- NOT upload/retry time. Migration safe on existing v0.6 tables.
alter table public.atelier_design_slots
  add column if not exists confirmed_at timestamptz not null default '-infinity'::timestamptz;
-- IMPORTANT: In production, commit through a single database transaction/RPC
-- with row locking (or advisory locking when the slot does not yet exist).
-- Compare (confirmed_at, operation_id) lexicographically and reject older edits.
-- In that SAME transaction enqueue old-path cleanup for accepted edits, and
-- incoming-path cleanup for rejected edits. Deletion workers must re-check
-- references before removing storage objects. Browser direct updates to the
-- pointer table must be revoked once the RPC is installed.


-- v1.2: Permanent proof deletion, scoped to the signed-in artist.
-- A tombstone prevents stale/offline uploads from resurrecting deleted proof records.
create table if not exists public.deleted_proofs (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('quest-proof','atelier-proof')),
  slot text not null,
  deleted_at timestamptz not null default now(),
  primary key(user_id,kind,slot)
);
alter table public.deleted_proofs enable row level security;
create policy "read own deleted proofs" on public.deleted_proofs for select to authenticated using (auth.uid()=user_id);
-- Only the deletion RPC writes tombstones. No client insert/update/delete policy.

create or replace function public.reject_deleted_proof_assets()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind in ('quest-proof','atelier-proof') and exists (
    select 1 from public.deleted_proofs d
    where d.user_id=new.user_id and d.kind=new.kind and d.slot=new.slot
  ) then raise exception 'Proof was permanently deleted'; end if;
  return new;
end; $$;
drop trigger if exists prevent_deleted_proof_resurrection on public.artwork_assets;
create trigger prevent_deleted_proof_resurrection before insert or update on public.artwork_assets
for each row execute function public.reject_deleted_proof_assets();

-- The RPC is idempotent: subsequent calls return no paths once metadata is removed.
-- NOTE: Production cleanup must retain paths until Storage removal is acknowledged;
-- this table provides a durable retry list even after metadata deletion.
create table if not exists public.proof_storage_cleanup (
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  primary key(user_id,storage_path)
);
alter table public.proof_storage_cleanup enable row level security;
create policy "read own proof cleanup" on public.proof_storage_cleanup for select to authenticated using (auth.uid()=user_id);
create policy "delete own proof cleanup" on public.proof_storage_cleanup for delete to authenticated using (auth.uid()=user_id);

create or replace function public.delete_proof_assets(p_kind text,p_slot text)
returns table(storage_path text) language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_kind not in ('quest-proof','atelier-proof') or p_slot is null or length(p_slot)>200 then
    raise exception 'Invalid proof deletion request';
  end if;
  insert into public.deleted_proofs(user_id,kind,slot) values(uid,p_kind,p_slot)
  on conflict do nothing;
  insert into public.proof_storage_cleanup(user_id,storage_path)
    select uid,a.storage_path from public.artwork_assets a
    where a.user_id=uid and a.kind=p_kind and a.slot=p_slot
  on conflict do nothing;
  delete from public.artwork_assets a where a.user_id=uid and a.kind=p_kind and a.slot=p_slot;
  return query select c.storage_path from public.proof_storage_cleanup c where c.user_id=uid
    and c.storage_path like uid::text || '/' || p_kind || '/%';
end; $$;
revoke all on function public.delete_proof_assets(text,text) from public, anon;
grant execute on function public.delete_proof_assets(text,text) to authenticated;

create or replace function public.ack_proof_storage_cleanup(p_paths text[])
returns void language sql security definer set search_path=public as $$
  delete from public.proof_storage_cleanup where user_id=auth.uid() and storage_path=any(p_paths);
$$;
revoke all on function public.ack_proof_storage_cleanup(text[]) from public, anon;
grant execute on function public.ack_proof_storage_cleanup(text[]) to authenticated;
