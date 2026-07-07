-- Migração menor para o perfil do aluno.
-- Rode este arquivo depois do schema base de students.

alter table public.students add column if not exists display_name text;
alter table public.students add column if not exists username text;
alter table public.students add column if not exists headline text;
alter table public.students add column if not exists bio text;
alter table public.students add column if not exists location text;
alter table public.students add column if not exists instagram_url text;
alter table public.students add column if not exists website_url text;
alter table public.students add column if not exists avatar_path text;
alter table public.students add column if not exists avatar_url text;
alter table public.students add column if not exists cover_path text;
alter table public.students add column if not exists cover_url text;

create unique index if not exists students_username_unique
on public.students (lower(username))
where username is not null and char_length(trim(username)) > 0;

grant update (
  full_name,
  whatsapp,
  age,
  sex,
  height_cm,
  weight_kg,
  goal,
  activity_level,
  experience,
  restrictions,
  display_name,
  username,
  headline,
  bio,
  location,
  instagram_url,
  website_url,
  avatar_path,
  avatar_url,
  cover_path,
  cover_url,
  status,
  updated_at
) on public.students to authenticated;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create or replace function private.set_students_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_students_updated_at on public.students;

create trigger set_students_updated_at
before update on public.students
for each row
execute function private.set_students_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-profile-media',
  'student-profile-media',
  true,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Student profile media can be uploaded by student or trainer" on storage.objects;
create policy "Student profile media can be uploaded by student or trainer"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-profile-media'
  and exists (
    select 1
    from public.students
    where students.id::text = (storage.foldername(name))[1]
      and (
        students.trainer_id = (select auth.uid())
        or students.auth_user_id = (select auth.uid())
      )
  )
);

drop policy if exists "Student profile media can be updated by student or trainer" on storage.objects;
create policy "Student profile media can be updated by student or trainer"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'student-profile-media'
  and exists (
    select 1
    from public.students
    where students.id::text = (storage.foldername(name))[1]
      and (
        students.trainer_id = (select auth.uid())
        or students.auth_user_id = (select auth.uid())
      )
  )
)
with check (
  bucket_id = 'student-profile-media'
  and exists (
    select 1
    from public.students
    where students.id::text = (storage.foldername(name))[1]
      and (
        students.trainer_id = (select auth.uid())
        or students.auth_user_id = (select auth.uid())
      )
  )
);

drop policy if exists "Student profile media can be deleted by student or trainer" on storage.objects;
create policy "Student profile media can be deleted by student or trainer"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-profile-media'
  and exists (
    select 1
    from public.students
    where students.id::text = (storage.foldername(name))[1]
      and (
        students.trainer_id = (select auth.uid())
        or students.auth_user_id = (select auth.uid())
      )
  )
);
