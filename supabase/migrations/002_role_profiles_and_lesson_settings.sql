alter table public.profiles
  add column if not exists grade smallint,
  add column if not exists class_number smallint,
  add column if not exists student_number smallint;

create table if not exists public.lesson_settings (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id text not null default (auth.jwt() ->> 'sub'),
  grade smallint not null check (grade between 1 and 3),
  class_number smallint not null check (class_number between 1 and 50),
  learning_date date not null,
  learning_time time not null,
  subject text not null default '수학',
  question_count smallint not null check (question_count between 1 and 50),
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_questions_are_array check (jsonb_typeof(questions) = 'array')
);

create index if not exists lesson_settings_teacher_idx
  on public.lesson_settings (teacher_user_id, learning_date desc);

create index if not exists lesson_settings_class_schedule_idx
  on public.lesson_settings (grade, class_number, learning_date, learning_time);

alter table public.lesson_settings enable row level security;

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
  )
);

drop policy if exists "Teachers manage their lesson settings" on public.lesson_settings;
create policy "Teachers manage their lesson settings"
on public.lesson_settings for update
to authenticated
using (teacher_user_id = (select auth.jwt() ->> 'sub'))
with check (teacher_user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Teachers delete their lesson settings" on public.lesson_settings;
create policy "Teachers delete their lesson settings"
on public.lesson_settings for delete
to authenticated
using (teacher_user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Role based lesson settings access" on public.lesson_settings;
create policy "Role based lesson settings access"
on public.lesson_settings for select
to authenticated
using (
  teacher_user_id = (select auth.jwt() ->> 'sub')
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = (select auth.jwt() ->> 'sub')
      and profiles.role = 'student'
      and profiles.grade = lesson_settings.grade
      and profiles.class_number = lesson_settings.class_number
  )
);
