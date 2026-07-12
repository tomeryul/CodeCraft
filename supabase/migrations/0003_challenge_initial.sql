-- Pre-placed bricks for sorting-style community challenges.
-- An array of [x,y] (plain block) or [x,y,n] (numbered block) entries that exist
-- on the grid before the level starts. RLS + author checks from 0001 still apply.
alter table public.challenges
  add column if not exists initial jsonb not null default '[]'::jsonb
  check (jsonb_array_length(initial) between 0 and 60);
