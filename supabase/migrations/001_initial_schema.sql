create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id text primary key default (auth.jwt() ->> 'sub'),
  role text not null check (role in ('student', 'admin')),
  display_name text not null,
  class_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  teacher_user_id text not null default (auth.jwt() ->> 'sub'),
  created_at timestamptz not null default now()
);

create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_user_id text,
  student_name text not null,
  student_number integer,
  created_at timestamptz not null default now(),
  unique (class_id, student_user_id)
);

create table if not exists public.lesson_problem_sets (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  learning_date date not null,
  subject text not null default '수학',
  unit_name text not null,
  problem_numbers integer[] not null default '{}',
  created_by text not null default (auth.jwt() ->> 'sub'),
  created_at timestamptz not null default now(),
  unique (class_id, learning_date)
);

create table if not exists public.diagnostic_responses (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lesson_problem_sets(id) on delete cascade,
  student_user_id text not null default (auth.jwt() ->> 'sub'),
  answers jsonb not null default '{}',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_user_id)
);

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.lesson_problem_sets enable row level security;
alter table public.diagnostic_responses enable row level security;

create policy "Users manage their own profile"
on public.profiles for all
to authenticated
using ((select auth.jwt() ->> 'sub') = user_id)
with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "Teachers manage their classes"
on public.classes for all
to authenticated
using ((select auth.jwt() ->> 'sub') = teacher_user_id)
with check ((select auth.jwt() ->> 'sub') = teacher_user_id);

create policy "Class members can view their class"
on public.classes for select
to authenticated
using (
  exists (
    select 1 from public.class_members
    where class_members.class_id = classes.id
      and class_members.student_user_id = (select auth.jwt() ->> 'sub')
  )
);

create policy "Teachers manage class members"
on public.class_members for all
to authenticated
using (
  exists (
    select 1 from public.classes
    where classes.id = class_members.class_id
      and classes.teacher_user_id = (select auth.jwt() ->> 'sub')
  )
)
with check (
  exists (
    select 1 from public.classes
    where classes.id = class_members.class_id
      and classes.teacher_user_id = (select auth.jwt() ->> 'sub')
  )
);

create policy "Students view their own membership"
on public.class_members for select
to authenticated
using (student_user_id = (select auth.jwt() ->> 'sub'));

create policy "Teachers manage lesson problem sets"
on public.lesson_problem_sets for all
to authenticated
using (
  exists (
    select 1 from public.classes
    where classes.id = lesson_problem_sets.class_id
      and classes.teacher_user_id = (select auth.jwt() ->> 'sub')
  )
)
with check (
  exists (
    select 1 from public.classes
    where classes.id = lesson_problem_sets.class_id
      and classes.teacher_user_id = (select auth.jwt() ->> 'sub')
  )
);

create policy "Class members view lesson problem sets"
on public.lesson_problem_sets for select
to authenticated
using (
  exists (
    select 1 from public.class_members
    where class_members.class_id = lesson_problem_sets.class_id
      and class_members.student_user_id = (select auth.jwt() ->> 'sub')
  )
);

create policy "Students manage their diagnostic responses"
on public.diagnostic_responses for all
to authenticated
using (student_user_id = (select auth.jwt() ->> 'sub'))
with check (student_user_id = (select auth.jwt() ->> 'sub'));

create policy "Teachers view class diagnostic responses"
on public.diagnostic_responses for select
to authenticated
using (
  exists (
    select 1
    from public.lesson_problem_sets
    join public.classes on classes.id = lesson_problem_sets.class_id
    where lesson_problem_sets.id = diagnostic_responses.lesson_id
      and classes.teacher_user_id = (select auth.jwt() ->> 'sub')
  )
);
