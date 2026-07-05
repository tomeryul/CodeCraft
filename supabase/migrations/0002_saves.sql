-- Cloud player profile: one row per user holds the whole game save (progress,
-- stats, robots, accessories, programs) as JSON. RLS ensures a user only ever
-- reads and writes their own row. The client upserts on user_id.
create table public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

create policy "read own save"   on public.saves for select to authenticated using (auth.uid() = user_id);
create policy "insert own save" on public.saves for insert to authenticated with check (auth.uid() = user_id);
create policy "update own save" on public.saves for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own save" on public.saves for delete to authenticated using (auth.uid() = user_id);
