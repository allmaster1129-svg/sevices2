create table if not exists public.lesson_question_responses (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lesson_settings(id) on delete cascade,
  student_user_id text not null default (auth.jwt() ->> 'sub'),
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_user_id),
  constraint lesson_response_answers_are_object
    check (jsonb_typeof(answers) = 'object')
);

create index if not exists lesson_responses_student_idx
  on public.lesson_question_responses (student_user_id, updated_at desc);

create index if not exists lesson_responses_lesson_idx
  on public.lesson_question_responses (lesson_id, updated_at desc);

alter table public.lesson_question_responses enable row level security;

create policy "Students view their lesson responses"
on public.lesson_question_responses for select
to authenticated
using (student_user_id = (select auth.jwt() ->> 'sub'));

create policy "Students create their lesson responses"
on public.lesson_question_responses for insert
to authenticated
with check (
  student_user_id = (select auth.jwt() ->> 'sub')
  and exists (
    select 1
    from public.lesson_settings
    join public.profiles
      on profiles.user_id = (select auth.jwt() ->> 'sub')
    where lesson_settings.id = lesson_question_responses.lesson_id
      and profiles.role = 'student'
      and profiles.grade = lesson_settings.grade
      and profiles.class_number = lesson_settings.class_number
  )
);

create policy "Students update their lesson responses"
on public.lesson_question_responses for update
to authenticated
using (student_user_id = (select auth.jwt() ->> 'sub'))
with check (student_user_id = (select auth.jwt() ->> 'sub'));

create policy "Teachers view lesson responses"
on public.lesson_question_responses for select
to authenticated
using (
  exists (
    select 1
    from public.lesson_settings
    where lesson_settings.id = lesson_question_responses.lesson_id
      and lesson_settings.teacher_user_id = (select auth.jwt() ->> 'sub')
  )
);
