create table if not exists public.lesson_student_feedback (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lesson_settings(id) on delete cascade,
  student_user_id text not null,
  teacher_user_id text not null default (auth.jwt() ->> 'sub'),
  feedback text not null check (char_length(feedback) between 1 and 2000),
  source text not null default 'manual' check (source in ('manual', 'gemini')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_user_id)
);

create index if not exists lesson_student_feedback_teacher_idx
  on public.lesson_student_feedback (teacher_user_id, lesson_id);

alter table public.lesson_student_feedback enable row level security;

drop policy if exists "Teachers manage lesson student feedback" on public.lesson_student_feedback;
create policy "Teachers manage lesson student feedback"
on public.lesson_student_feedback
for all
to authenticated
using (
  teacher_user_id = (select auth.jwt() ->> 'sub')
  and exists (
    select 1
    from public.lesson_settings
    where lesson_settings.id = lesson_student_feedback.lesson_id
      and lesson_settings.teacher_user_id = (select auth.jwt() ->> 'sub')
  )
)
with check (
  teacher_user_id = (select auth.jwt() ->> 'sub')
  and exists (
    select 1
    from public.lesson_settings
    where lesson_settings.id = lesson_student_feedback.lesson_id
      and lesson_settings.teacher_user_id = (select auth.jwt() ->> 'sub')
  )
);

drop policy if exists "Students read their lesson feedback" on public.lesson_student_feedback;
create policy "Students read their lesson feedback"
on public.lesson_student_feedback
for select
to authenticated
using (student_user_id = (select auth.jwt() ->> 'sub'));
