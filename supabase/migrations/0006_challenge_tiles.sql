-- Puzzle terrain for community challenges: a sparse array of [x, y, type, arg]
-- entries laid over the grid.
--   type: "wall" | "pit" | "key" | "door" | "portal"
--   arg:  colour 1-4 for key/door (a key opens every door of its colour) and for
--         portal (two portals sharing a colour are a pair). 0 for wall/pit.
-- Multi-level challenges keep each level's own tiles inside `stages`; this
-- top-level column mirrors LEVEL 1, the same convention as `cells` / `initial`.
-- Bound 80 = the largest publishable grid (gw 10 x gh 8).
alter table public.challenges
  add column if not exists tiles jsonb not null default '[]'::jsonb
    check (jsonb_array_length(tiles) between 0 and 80);
