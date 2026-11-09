-- v1.7: append-only, server-authoritative completion ledger.
-- Install after schema.sql. Authenticated clients have EXECUTE only, never table writes.
create table if not exists public.completion_awards (
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle integer not null check (cycle between 0 and 5),
  week_key date not null,
  kind text not null check (kind in ('mission','quest')),
  slot text not null,
  skill text not null,
  xp integer not null check (xp between 1 and 50),
  completed_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key(user_id,cycle,week_key,kind,slot),
  check ((kind='quest' and slot='weekly') or (kind='mission' and slot in ('0','1','2','3','4')))
);
alter table public.completion_awards enable row level security;
create policy "read own completion awards" on public.completion_awards for select to authenticated using (auth.uid()=user_id);
revoke all on public.completion_awards from anon, authenticated;
grant select on public.completion_awards to authenticated;

-- Single transaction: UNIQUE prevents concurrent duplicate rewards. Server determines
-- XP and skill, not client-provided values. This starter schema uses fixed mission slots;
-- production rotating quests must be bound to a persisted server-assigned quest.
create or replace function public.submit_completion(
  p_cycle integer, p_week_key date, p_kind text, p_slot text,
  p_completed_at timestamptz
) returns table(outcome text, awarded_xp integer, total_cycle_xp bigint)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_zone text;
  v_local_date date;
  v_week date;
  v_skill text;
  v_xp integer;
  v_inserted integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_cycle is null or p_cycle < 0 or p_cycle > 5 or p_completed_at is null
    or p_week_key is null or p_kind not in ('mission','quest') then
    raise exception 'Invalid completion';
  end if;
  -- Serialized per-account, including simultaneous first submissions.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 719));
  select coalesce(state->>'accountTimeZone','UTC') into v_zone
    from public.artist_profiles where user_id=uid;
  if v_zone is null then raise exception 'Account profile required'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name=v_zone) then
    raise exception 'Invalid account time zone';
  end if;
  v_local_date := (p_completed_at at time zone v_zone)::date;
  v_week := v_local_date - ((extract(isodow from v_local_date)::int)-1);
  if v_week <> p_week_key or p_completed_at > pg_catalog.clock_timestamp() + interval '5 minutes' then
    return query select 'rejected'::text,0::integer,
      coalesce(sum(a.xp),0)::bigint from public.completion_awards a
      where a.user_id=uid and a.cycle=p_cycle;
    return;
  end if;
  -- No arbitrary XP or skill from the client.
  if p_kind='quest' and p_slot='weekly' then
    v_skill := 'Quest'; v_xp := 50;
  elsif p_kind='mission' and p_slot in ('0','1','2','3','4') then
    v_skill := (array['Anatomy','Faces','Color','Perspective','Design'])[p_slot::int+1];
    v_xp := 20;
  else
    raise exception 'Invalid completion slot';
  end if;
  insert into public.completion_awards(user_id,cycle,week_key,kind,slot,skill,xp,completed_at)
  values(uid,p_cycle,p_week_key,p_kind,p_slot,v_skill,v_xp,p_completed_at)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return query select case when v_inserted=1 then 'confirmed' else 'duplicate' end::text,
    case when v_inserted=1 then v_xp else 0 end,
    coalesce(sum(a.xp),0)::bigint from public.completion_awards a
    where a.user_id=uid and a.cycle=p_cycle;
end; $$;
revoke all on function public.submit_completion(integer,date,text,text,timestamptz) from public, anon;
grant execute on function public.submit_completion(integer,date,text,text,timestamptz) to authenticated;
