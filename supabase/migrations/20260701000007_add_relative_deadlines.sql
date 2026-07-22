-- Assignments linked to a course can now have a due date that's relative to
-- when each individual learner starts the course, instead of (or in addition
-- to) a fixed calendar date. This is fairer when learners are assigned to a
-- course at different times / start it whenever they want - each learner
-- gets the same amount of time, counted from when THEY started, rather than
-- everyone sharing one fixed deadline.
ALTER TABLE public.course_assessments
ADD COLUMN IF NOT EXISTS due_days_after_start INTEGER;

-- Optional overall time limit (in days) to complete an entire course, also
-- counted from when the individual learner started it. This column already
-- existed in the live database (added directly via SQL editor at some point,
-- like a couple of other columns we've found this way) but was never
-- captured as a migration and never wired up in the app - formalizing it
-- here and building the actual feature on top of it.
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS completion_days INTEGER;
