-- Store the author's own solution program with a challenge, so it can be loaded
-- back in EDIT mode. (In solve/play mode the client never reads it — players
-- write their own program.) For multi-level challenges each level keeps its own
-- solution inside the `stages` jsonb; this top-level column is level 1's.
alter table public.challenges
  add column if not exists solution jsonb not null default '[]'::jsonb
    check (jsonb_array_length(solution) between 0 and 200);
