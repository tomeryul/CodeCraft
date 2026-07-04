-- CodeCraft: community challenges table + RLS.
-- Auth itself uses Supabase's built-in email/password provider (auth.users) —
-- no extra profile table needed. Recommended dashboard setting:
-- Authentication → Sign In / Up → Email → disable "Confirm email"
-- so kids can play immediately after signing up.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  author uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default 'builder' check (char_length(author_name) between 1 and 20),
  name text not null check (char_length(name) between 2 and 30),
  gw int not null default 8 check (gw between 4 and 10),
  gh int not null default 6 check (gh between 4 and 8),
  start_x int not null default 0 check (start_x >= 0),
  start_y int not null default 0 check (start_y >= 0),
  start_dir int not null default 1 check (start_dir between 0 and 3),
  cells jsonb not null check (jsonb_array_length(cells) between 1 and 60),
  max_blocks int not null check (max_blocks between 3 and 30),
  solves int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.challenges enable row level security;

create policy "challenges are readable by everyone"
  on public.challenges for select using (true);

create policy "users insert their own challenges"
  on public.challenges for insert to authenticated
  with check (auth.uid() = author);

create policy "users delete their own challenges"
  on public.challenges for delete to authenticated
  using (auth.uid() = author);

-- solve counter increments through a definer function so the column
-- can't be set arbitrarily by clients
create or replace function public.add_solve(cid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.challenges set solves = solves + 1 where id = cid;
$$;

-- only signed-in players may increment the solve counter
grant execute on function public.add_solve to authenticated;
revoke execute on function public.add_solve(uuid) from anon, public;
