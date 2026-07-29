create table if not exists public.lesson_post_activity_responses (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lesson_settings(id) on delete cascade,
  student_user_id text not null default (auth.jwt() ->> 'sub'),
  answers jsonb not null default '{}'::jsonb,
  reflection text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_user_id),
  constraint post_activity_answers_are_object
    check (jsonb_typeof(answers) = 'object'),
  constraint post_activity_reflection_length
    check (char_length(reflection) <= 1000)
);

create index if not exists post_activity_student_idx
  on public.lesson_post_activity_responses (student_user_id, updated_at desc);

create index if not exists post_activity_lesson_idx
  on public.lesson_post_activity_responses (lesson_id, updated_at desc);

alter table public.lesson_post_activity_responses enable row level security;

drop policy if exists "Students manage their post activity responses"
on public.lesson_post_activity_responses;

create policy "Students manage their post activity responses"
on public.lesson_post_activity_responses for all
to authenticated
using (student_user_id = (select auth.jwt() ->> 'sub'))
with check (student_user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Teachers view post activity responses"
on public.lesson_post_activity_responses;

create policy "Teachers view post activity responses"
on public.lesson_post_activity_responses for select
to authenticated
using (public.teacher_owns_lesson(lesson_id));
