-- Raise the publishable block budget from 30 to 999.
--
-- The original bound assumed a challenge was a short puzzle you compress into a
-- loop. Authors building long straight-line algorithm levels (a sort, a reversal,
-- a search written out step by step) legitimately need hundreds of blocks, and the
-- creator now offers 3-999, so the constraint was the only thing left saying no.
--
-- Dropping and re-adding is the only way to widen a CHECK: `alter constraint`
-- cannot change the expression. The name is Postgres' own default for the inline
-- `check (max_blocks between 3 and 30)` in 0001, and `if exists` keeps this
-- migration replayable on a database where it has already been widened.
alter table public.challenges
  drop constraint if exists challenges_max_blocks_check;
alter table public.challenges
  add constraint challenges_max_blocks_check check (max_blocks between 3 and 999);
