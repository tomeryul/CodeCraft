-- Let authors edit their own community challenges, and support multi-level
-- challenges (extra levels stored as a jsonb array) + a difficulty rating.
-- The top-level cells/start/max_blocks stay = the FIRST level (so old single-level
-- clients still read a playable challenge); `stages` holds the full level list
-- (empty = a plain single-level challenge). RLS author checks from 0001 apply.
alter table public.challenges
  add column if not exists diff int not null default 2 check (diff between 1 and 3),
  add column if not exists stages jsonb not null default '[]'::jsonb
    check (jsonb_array_length(stages) between 0 and 20),
  add column if not exists updated_at timestamptz not null default now();

create policy "users update their own challenges"
  on public.challenges for update to authenticated
  using (auth.uid() = author) with check (auth.uid() = author);
