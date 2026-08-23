-- ============================================================================
-- Close the anon hole on the SECURITY DEFINER functions.
--
-- 0001 and 0009 each ended with `revoke ... from public` (and 0001 also named
-- anon). That looked right and was not: Supabase ships ALTER DEFAULT PRIVILEGES
-- granting EXECUTE on new functions in `public` to the anon and authenticated
-- ROLES. Revoking from the PUBLIC pseudo-role does not touch a grant held by
-- the anon role, so anon kept EXECUTE on all three.
--
-- Measured against the live project before this migration:
--   add_solve        -> HTTP 204  (anon could bump any level's counter, forever)
--   report_challenge -> HTTP 400  (saved only by its own auth.uid() guard)
--   block_author     -> HTTP 400  (saved only by a NOT NULL constraint)
--
-- The publishable key is in the client source, so "anon" means anyone.
-- Fix both halves: revoke from the roles, and guard the bodies, so neither
-- alone is load-bearing.
-- ============================================================================

-- add_solve had no guard at all: it was reachable and it worked.
create or replace function public.add_solve(cid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be signed in to record a solve';
  end if;
  update public.challenges set solves = solves + 1 where id = cid;
end;
$$;

create or replace function public.block_author(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be signed in to block';
  end if;
  insert into public.user_blocks (blocker, blocked)
  values (auth.uid(), uid)
  on conflict do nothing;
end;
$$;

-- Revoke from the ROLES, not just PUBLIC. CREATE OR REPLACE above also
-- re-applies the default privileges, so these must come after it.
revoke execute on function public.add_solve(uuid)              from anon, public;
revoke execute on function public.block_author(uuid)           from anon, public;
revoke execute on function public.report_challenge(uuid, text) from anon, public;

grant execute on function public.add_solve(uuid)              to authenticated;
grant execute on function public.block_author(uuid)           to authenticated;
grant execute on function public.report_challenge(uuid, text) to authenticated;
