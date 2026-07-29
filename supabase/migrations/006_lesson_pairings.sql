create table if not exists public.lesson_pairings (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lesson_settings(id) on delete cascade,
  student_user_id text not null,
  partner_user_id text not null,
  partner_name text not null,
  partner_student_number smallint,
  score smallint not null default 0 check (score >= 0),
  helps_with smallint[] not null default '{}',
  partner_helps_with smallint[] not null default '{}',
  generated_at timestamptz not null default now(),
  unique (lesson_id, student_user_id)
);

create index if not exists lesson_pairings_student_idx
  on public.lesson_pairings (student_user_id, generated_at desc);

create index if not exists lesson_pairings_lesson_idx
  on public.lesson_pairings (lesson_id, generated_at desc);

alter table public.lesson_pairings enable row level security;

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
    where lesson_settings.id = target_lesson_id
      and lesson_settings.teacher_user_id = (select auth.jwt() ->> 'sub')
  );
$$;

revoke all on function public.teacher_owns_lesson(uuid) from public;
grant execute on function public.teacher_owns_lesson(uuid) to authenticated;

drop policy if exists "Students view their lesson pairings"
on public.lesson_pairings;

create policy "Students view their lesson pairings"
on public.lesson_pairings for select
to authenticated
using (student_user_id = (select auth.jwt() ->> 'sub'));

drop policy if exists "Teachers manage lesson pairings"
on public.lesson_pairings;

create policy "Teachers manage lesson pairings"
on public.lesson_pairings for all
to authenticated
using (public.teacher_owns_lesson(lesson_id))
with check (public.teacher_owns_lesson(lesson_id));
