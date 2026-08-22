-- ============================================================================
-- Moderation for community challenges.
--
-- The app publishes player-made levels to a public list. Both stores require
-- three things of any app that does that, and none of them existed: a way to
-- REPORT content, a way to BLOCK an author, and a route by which offending
-- content actually disappears. In a kids' app the absence of these is a
-- straight rejection, not a note.
--
-- The design here assumes nobody is on call. Reports auto-hide at a threshold,
-- so removal does not depend on a human noticing — a moderator queue is a
-- refinement on top, not a prerequisite.
-- ============================================================================

-- ---------------------------------------------------------------- challenges
alter table public.challenges
  add column if not exists hidden  boolean not null default false,
  add column if not exists reports int     not null default 0;

-- A published level carries a nickname the player chose. It used to carry the
-- local-part of their EMAIL, which for a child is very often their real name.
alter table public.challenges
  add column if not exists display_name text;

create index if not exists challenges_visible_idx
  on public.challenges (created_at desc) where not hidden;

-- Hidden rows leave the public list. The author still sees their own, so a
-- false report cannot make someone's work vanish without explanation.
drop policy if exists "challenges are readable by everyone" on public.challenges;
create policy "visible challenges are readable by everyone"
  on public.challenges for select
  using (not hidden or auth.uid() = author);

-- ------------------------------------------------------------------- reports
create table if not exists public.challenge_reports (
  id         uuid primary key default gen_random_uuid(),
  challenge  uuid not null references public.challenges(id) on delete cascade,
  reporter   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason     text not null default 'other'
             check (reason in ('rude','scary','broken','copied','other')),
  created_at timestamptz not null default now(),
  -- one report per person per level: otherwise one angry child can bury anyone
  unique (challenge, reporter)
);
alter table public.challenge_reports enable row level security;

create policy "reporters see their own reports"
  on public.challenge_reports for select to authenticated
  using (auth.uid() = reporter);

-- ------------------------------------------------------------------- blocking
create table if not exists public.user_blocks (
  blocker    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.user_blocks enable row level security;

create policy "you see your own block list"
  on public.user_blocks for select to authenticated using (auth.uid() = blocker);
create policy "you manage your own block list"
  on public.user_blocks for insert to authenticated with check (auth.uid() = blocker);
create policy "you can unblock"
  on public.user_blocks for delete to authenticated using (auth.uid() = blocker);

-- --------------------------------------------------------------------- report
-- SECURITY DEFINER so the counter and the hidden flag cannot be written by a
-- client directly — the only way either moves is through this function.
create or replace function public.report_challenge(cid uuid, why text default 'other')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  if auth.uid() is null then
    raise exception 'must be signed in to report';
  end if;

  insert into public.challenge_reports (challenge, reporter, reason)
  values (cid, auth.uid(), coalesce(nullif(why,''),'other'))
  on conflict (challenge, reporter) do nothing;

  select count(*) into n from public.challenge_reports where challenge = cid;

  -- Three independent people is the line. Nobody has to be watching for
  -- content to come down, which is the whole point.
  update public.challenges
     set reports = n,
         hidden  = (n >= 3)
   where id = cid;
end;
$$;
revoke all on function public.report_challenge(uuid, text) from public;
grant execute on function public.report_challenge(uuid, text) to authenticated;

-- ---------------------------------------------------------------------- block
create or replace function public.block_author(uid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_blocks (blocker, blocked)
  values (auth.uid(), uid)
  on conflict do nothing;
$$;
revoke all on function public.block_author(uuid) from public;
grant execute on function public.block_author(uuid) to authenticated;
