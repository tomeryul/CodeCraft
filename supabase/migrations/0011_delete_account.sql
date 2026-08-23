-- ============================================================================
-- Let a player delete their own account, from inside the app.
--
-- App Store Review Guideline 5.1.1(v): an app that lets you create an account
-- must let you delete it from within the app. Offering only "log out" is a
-- rejection. Google Play asks for the same thing.
--
-- Deleting the auth.users row is enough to remove everything: every table that
-- references a user already cascades. Verified against the live database --
--   saves.user_id              -> auth.users(id) ON DELETE CASCADE
--   challenges.author          -> auth.users(id) ON DELETE CASCADE
--   challenge_reports.reporter -> auth.users(id) ON DELETE CASCADE
--   user_blocks.blocker        -> auth.users(id) ON DELETE CASCADE
--   user_blocks.blocked        -> auth.users(id) ON DELETE CASCADE
-- and challenge_reports.challenge cascades from challenges, so a deleted
-- author's levels take their reports with them.
--
-- The client only ever holds the publishable key, so this cannot go through
-- the admin API. SECURITY DEFINER instead, keyed strictly to auth.uid() -- the
-- caller's own JWT decides whose account dies, and the argument list is empty
-- so there is nothing to point at anyone else.
-- ============================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'must be signed in to delete an account';
  end if;
  delete from auth.users where id = me;
end;
$$;

-- Revoke from the anon ROLE, not just PUBLIC: Supabase's default privileges
-- grant EXECUTE to anon on every new function in `public`, and CREATE OR
-- REPLACE re-applies them. This is the mistake 0010 had to come back and fix.
revoke execute on function public.delete_my_account() from anon, public;
grant  execute on function public.delete_my_account() to authenticated;
