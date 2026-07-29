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
    where lesson_settings.teacher_user_id = (select auth.jwt() ->> 'sub')
      and lesson_settings.grade = target_grade
      and lesson_settings.class_number = target_class_number
  );
$$;

revoke all on function public.teacher_owns_lesson_class(smallint, smallint)
from public;

grant execute on function public.teacher_owns_lesson_class(smallint, smallint)
to authenticated;

drop policy if exists "Teachers view students in their lesson classes"
on public.profiles;

create policy "Teachers view students in their lesson classes"
on public.profiles for select
to authenticated
using (
  role = 'student'
  and public.teacher_owns_lesson_class(grade, class_number)
);
