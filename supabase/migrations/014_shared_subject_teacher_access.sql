-- Teachers who currently have the same active subject share lesson access.
-- The original creator remains recorded in teacher_user_id for audit purposes.

create or replace function public.teacher_owns_lesson(target_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.lesson_settings
    join public.profiles
      on profiles.user_id = (select auth.jwt() ->> 'sub')
    where lesson_settings.id = target_lesson_id
      and profiles.role = 'admin'
      and profiles.subject = lesson_settings.subject
  );
$$;

revoke all on function public.teacher_owns_lesson(uuid) from public;
grant execute on function public.teacher_owns_lesson(uuid) to authenticated;

create or replace function public.teacher_owns_lesson_class(
  target_grade smallint,
  target_class_number smallint
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.lesson_settings
    join public.profiles
      on profiles.user_id = (select auth.jwt() ->> 'sub')
    where profiles.role = 'admin'
      and profiles.subject = lesson_settings.subject
      and lesson_settings.grade = target_grade
      and lesson_settings.class_number = target_class_number
  );
$$;

revoke all on function public.teacher_owns_lesson_class(smallint, smallint)
from public;
grant execute on function public.teacher_owns_lesson_class(smallint, smallint)
to authenticated;

drop policy if exists "Teachers create lesson settings" on public.lesson_settings;
create policy "Teachers create lesson settings"
on public.lesson_settings for insert
to authenticated
with check (
  teacher_user_id = (select auth.jwt() ->> 'sub')
  and exists (
    select 1
    from public.profiles
    where profiles.user_id = (select auth.jwt() ->> 'sub')
      and profiles.role = 'admin'
      and profiles.subject = lesson_settings.subject
  )
);

drop policy if exists "Teachers manage their lesson settings" on public.lesson_settings;
create policy "Teachers manage their lesson settings"
on public.lesson_settings for update
to authenticated
using (public.teacher_owns_lesson(id))
with check (public.teacher_owns_lesson(id));

drop policy if exists "Teachers delete their lesson settings" on public.lesson_settings;
create policy "Teachers delete their lesson settings"
on public.lesson_settings for delete
to authenticated
using (public.teacher_owns_lesson(id));

drop policy if exists "Role based lesson settings access" on public.lesson_settings;
create policy "Role based lesson settings access"
on public.lesson_settings for select
to authenticated
using (
  public.teacher_owns_lesson(id)
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = (select auth.jwt() ->> 'sub')
      and profiles.role = 'student'
      and profiles.grade = lesson_settings.grade
      and profiles.class_number = lesson_settings.class_number
      and (
        lesson_settings.subject = any(profiles.subjects)
        or (
          cardinality(profiles.subjects) = 0
          and profiles.subject = lesson_settings.subject
        )
      )
  )
);

drop policy if exists "Teachers view lesson responses"
on public.lesson_question_responses;
create policy "Teachers view lesson responses"
on public.lesson_question_responses for select
to authenticated
using (public.teacher_owns_lesson(lesson_id));

drop policy if exists "Teachers manage lesson student feedback"
on public.lesson_student_feedback;
create policy "Teachers manage lesson student feedback"
on public.lesson_student_feedback for all
to authenticated
using (public.teacher_owns_lesson(lesson_id))
with check (
  teacher_user_id = (select auth.jwt() ->> 'sub')
  and public.teacher_owns_lesson(lesson_id)
);
