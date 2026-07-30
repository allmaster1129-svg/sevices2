-- Keep the original lesson row so its student responses and pairings remain
-- connected, while applying the most recently saved question settings.
with ranked_lessons as (
  select
    id,
    first_value(id) over (
      partition by
        teacher_user_id,
        grade,
        class_number,
        learning_date,
        learning_time,
        subject
      order by created_at asc, id asc
    ) as keep_id,
    row_number() over (
      partition by
        teacher_user_id,
        grade,
        class_number,
        learning_date,
        learning_time,
        subject
      order by updated_at desc, created_at desc, id desc
    ) as latest_rank
  from public.lesson_settings
),
latest_settings as (
  select
    ranked_lessons.keep_id,
    lesson_settings.question_count,
    lesson_settings.questions,
    lesson_settings.updated_at
  from ranked_lessons
  join public.lesson_settings
    on lesson_settings.id = ranked_lessons.id
  where ranked_lessons.latest_rank = 1
)
update public.lesson_settings as original
set
  question_count = latest_settings.question_count,
  questions = latest_settings.questions,
  updated_at = greatest(original.updated_at, latest_settings.updated_at)
from latest_settings
where original.id = latest_settings.keep_id;

with ranked_lessons as (
  select
    id,
    row_number() over (
      partition by
        teacher_user_id,
        grade,
        class_number,
        learning_date,
        learning_time,
        subject
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.lesson_settings
)
delete from public.lesson_settings
using ranked_lessons
where lesson_settings.id = ranked_lessons.id
  and ranked_lessons.duplicate_rank > 1;

create unique index if not exists lesson_settings_unique_schedule_idx
  on public.lesson_settings (
    teacher_user_id,
    grade,
    class_number,
    learning_date,
    learning_time,
    subject
  );
