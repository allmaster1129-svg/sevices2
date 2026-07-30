drop policy if exists "Teachers update students in their lesson classes"
on public.profiles;

create policy "Teachers update students in their lesson classes"
on public.profiles for update
to authenticated
using (
  role = 'student'
  and public.teacher_owns_lesson_class(grade, class_number)
)
with check (
  role = 'student'
  and public.teacher_owns_lesson_class(grade, class_number)
);
