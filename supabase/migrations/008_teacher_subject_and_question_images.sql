alter table public.profiles
  add column if not exists subject text;

update public.profiles
set subject = '수학'
where role = 'admin'
  and (subject is null or btrim(subject) = '');

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'lesson-question-images',
  'lesson-question-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Teachers upload lesson question images" on storage.objects;
create policy "Teachers upload lesson question images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'lesson-question-images'
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  and exists (
    select 1
    from public.profiles
    where profiles.user_id = (select auth.jwt() ->> 'sub')
      and profiles.role = 'admin'
  )
);
