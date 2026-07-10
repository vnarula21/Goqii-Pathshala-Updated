-- courses had an "Admins can delete any course" policy but no matching
-- SELECT policy, so admins could only see courses they personally created
-- (almost always zero, since admins don't normally author courses). This is
-- why "Courses" showed an empty "My Courses" list for admin even though
-- delete permission already worked. modules already has this exact pattern
-- ("Admins can view all modules") - this brings courses in line with it.

CREATE POLICY "Admins can view all courses"
ON public.courses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- The courses list also joins course_modules and course_assessments to show
-- what's inside each course - these had no admin policy at all either, so
-- even after fixing courses itself, admin would see course cards with no
-- modules/assessments inside them. Give admin full access to both.

CREATE POLICY "Admins can manage all course_modules"
ON public.course_modules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all course_assessments"
ON public.course_assessments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

