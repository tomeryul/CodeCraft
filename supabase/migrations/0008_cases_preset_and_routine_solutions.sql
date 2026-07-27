-- Three things an authored challenge could not carry yet.

-- 1. A solution with routines.
--    `solution` was checked with jsonb_array_length, so it could only ever be a
--    flat array — publishing a challenge you solved with 🔧 Routines silently
--    dropped A and B and kept only the main program. It may now also be the
--    {main, routines} shape packProg() produces once a routine is in use.
--    The length bound rises to 999 alongside the block budget (0007).
alter table public.challenges
  drop constraint if exists challenges_solution_check;
alter table public.challenges
  add constraint challenges_solution_check check (
    (jsonb_typeof(solution) = 'array'
      and jsonb_array_length(solution) between 0 and 999)
    or (jsonb_typeof(solution) = 'object'
      and jsonb_array_length(coalesce(solution -> 'main', '[]'::jsonb)) between 0 and 999)
  );

-- 2. Several inputs for one program.
--    Each entry overrides the board's pre-placed blocks (and may carry its own
--    `expect` for answer goals, or `hidden` to keep the input off-screen), so the
--    same program has to be right for every one of them. Empty = a single-input
--    challenge, exactly as before.
alter table public.challenges
  add column if not exists cases jsonb not null default '[]'::jsonb
    check (jsonb_typeof(cases) = 'array' and jsonb_array_length(cases) between 0 and 8);

-- 3. A starter routine the challenge HANDS the player.
--    Same {main, routines} shape as `solution`; the client applies it only when
--    the player has nothing of their own saved for that challenge yet.
alter table public.challenges
  add column if not exists preset jsonb not null default '[]'::jsonb
    check (
      (jsonb_typeof(preset) = 'array'
        and jsonb_array_length(preset) between 0 and 999)
      or (jsonb_typeof(preset) = 'object'
        and jsonb_array_length(coalesce(preset -> 'main', '[]'::jsonb)) between 0 and 999)
    );
