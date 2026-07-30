create or replace function public.teacher_update_student_profile(
  target_user_id text,
  target_display_name text,
  target_grade smallint,
  target_class_number smallint,
  target_student_number smallint,
  target_subject text
)
returns table (
  user_id text,
  display_name text,
  grade smallint,
  class_number smallint,
  student_number smallint,
  subject text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  caller_user_id text := auth.jwt() ->> 'sub';
  current_student public.profiles%rowtype;
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.user_id = caller_user_id
      and profiles.role = 'admin'
  ) then
    raise exception 'teacher access required' using errcode = '42501';
  end if;

  select *
  into current_student
  from public.profiles
  where profiles.user_id = target_user_id
    and profiles.role = 'student';

  if not found
    or not public.teacher_owns_lesson_class(
      current_student.grade,
      current_student.class_number
    )
  then
    raise exception 'student is outside managed classes' using errcode = '42501';
  end if;

  if not public.teacher_owns_lesson_class(target_grade, target_class_number) then
    raise exception 'target class is outside managed classes' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.profiles
    where profiles.role = 'student'
      and profiles.grade = target_grade
      and profiles.class_number = target_class_number
      and profiles.student_number = target_student_number
      and profiles.user_id <> target_user_id
  ) then
    raise exception 'student number already exists' using errcode = '23505';
  end if;

  return query
  update public.profiles
  set display_name = btrim(target_display_name),
      grade = target_grade,
      class_number = target_class_number,
      student_number = target_student_number,
      subject = target_subject,
      class_code = target_grade::text || '-' || target_class_number::text,
      updated_at = now()
  where profiles.user_id = target_user_id
    and profiles.role = 'student'
  returning
    profiles.user_id,
    profiles.display_name,
    profiles.grade,
    profiles.class_number,
    profiles.student_number,
    profiles.subject,
    profiles.updated_at;
end;
$$;

revoke all on function public.teacher_update_student_profile(
  text,
  text,
  smallint,
  smallint,
  smallint,
  text
) from public;

grant execute on function public.teacher_update_student_profile(
  text,
  text,
  smallint,
  smallint,
  smallint,
  text
) to authenticated;
