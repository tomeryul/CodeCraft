-- 0012 — two holes the RLS review turned up.
--
-- 1. RLS says WHICH ROWS a client may write; it says nothing about WHICH
--    COLUMNS. `authenticated` held table-level UPDATE on all 24 columns of
--    `challenges`, and the policy only checks `auth.uid() = author`. So an
--    author could PATCH `hidden = false` on their own challenge and undo the
--    hide that report_challenge applied at three reports — the moderation
--    path this app relies on for a child-facing feed. The same grant let
--    them set `solves` to any number.
--
--    Column privileges are additive, so a table-level UPDATE cannot be
--    narrowed by revoking columns: the grant is replaced by a per-column
--    one covering exactly the fields a level legitimately edits.
--
-- 2. add_solve incremented a counter with no record of who solved what, so
--    any signed-in user could call it in a loop on any challenge. It now
--    records (challenge, solver) once and derives the count, which is the
--    shape challenge_reports already uses. Existing totals are kept with
--    greatest(): they were never verifiable, and nobody's number should
--    drop because of this change.
--
-- 3. `anon` carried INSERT/UPDATE/DELETE grants it never uses. RLS blocks it
--    today because every write policy names `authenticated`, but that is one
--    permissive policy away from mattering.

-- ---------- 1. column-scoped writes ----------
revoke update on public.challenges from authenticated, anon;
grant  update (author_name, display_name, name, gw, gh,
               start_x, start_y, start_dir, cells, max_blocks,
               initial, diff, stages, updated_at, solution, tiles,
               cases, preset)
  on public.challenges to authenticated;

-- ---------- 3. anon writes nothing ----------
revoke insert, update, delete on public.challenges       from anon;
revoke insert, update, delete on public.saves            from anon;
revoke insert, update, delete on public.user_blocks      from anon;
revoke insert, update, delete on public.challenge_reports from anon;

-- ---------- 2. one solve per player ----------
create table if not exists public.challenge_solves(
  challenge uuid not null references public.challenges(id) on delete cascade,
  solver    uuid not null references auth.users(id)        on delete cascade,
  solved_at timestamptz not null default now(),
  primary key (challenge, solver)
);
alter table public.challenge_solves enable row level security;

drop policy if exists "you see your own solves" on public.challenge_solves;
create policy "you see your own solves" on public.challenge_solves
  for select to authenticated using (auth.uid() = solver);

-- no INSERT policy on purpose: only the definer function below writes here
revoke all on public.challenge_solves from anon, authenticated;
grant select on public.challenge_solves to authenticated;

create or replace function public.add_solve(cid uuid)
returns void language plpgsql security definer set search_path = 'public'
as $$
declare n int;
begin
  if auth.uid() is null then
    raise exception 'must be signed in to record a solve';
  end if;
  insert into public.challenge_solves (challenge, solver)
  values (cid, auth.uid())
  on conflict (challenge, solver) do nothing;

  select count(*) into n from public.challenge_solves where challenge = cid;

  update public.challenges
     set solves = greatest(coalesce(solves,0), n)
   where id = cid;
end;
$$;

-- default privileges hand EXECUTE to the anon ROLE on every new public
-- function, and create-or-replace re-applies them, so the revoke comes after
revoke execute on function public.add_solve(uuid) from anon, public;
grant  execute on function public.add_solve(uuid) to authenticated;
