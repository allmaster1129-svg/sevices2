drop policy if exists "Teachers view students in their lesson classes" on public.profiles;

create policy "Teachers view students in their lesson classes"
on public.profiles for select
to authenticated
using (
  role = 'student'
  and exists (
    select 1
    from public.lesson_settings
    where lesson_settings.teacher_user_id = (select auth.jwt() ->> 'sub')
      and lesson_settings.grade = profiles.grade
      and lesson_settings.class_number = profiles.class_number
  )
);
