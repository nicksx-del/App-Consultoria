-- Cria a primeira estrutura funcional de alunos da consultoria.
-- Treinadores cadastram alunos; alunos apenas leem o proprio registro.

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'student_status') then
    create type public.student_status as enum ('active', 'paused', 'archived');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'student_sex') then
    create type public.student_sex as enum ('male', 'female', 'other');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'activity_level') then
    create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'training_experience') then
    create type public.training_experience as enum ('beginner', 'intermediate', 'advanced');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'student_goal') then
    create type public.student_goal as enum ('hypertrophy', 'fat_loss', 'recomposition', 'health', 'performance');
  end if;
end;
$$;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users(id) on delete cascade,
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  whatsapp text,
  age integer,
  sex public.student_sex,
  height_cm numeric(5, 2),
  weight_kg numeric(6, 2),
  goal public.student_goal not null default 'hypertrophy',
  activity_level public.activity_level not null default 'moderate',
  experience public.training_experience not null default 'beginner',
  restrictions text,
  display_name text,
  username text,
  headline text,
  bio text,
  location text,
  instagram_url text,
  website_url text,
  avatar_path text,
  avatar_url text,
  cover_path text,
  cover_url text,
  status public.student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_full_name_length check (char_length(trim(full_name)) >= 2),
  constraint students_email_shape check (position('@' in email) > 1),
  constraint students_age_range check (age is null or (age >= 5 and age <= 120)),
  constraint students_height_range check (height_cm is null or (height_cm >= 80 and height_cm <= 250)),
  constraint students_weight_range check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 400))
);

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

create unique index if not exists students_trainer_email_unique
on public.students (trainer_id, lower(email));

create unique index if not exists students_username_unique
on public.students (lower(username))
where username is not null and char_length(trim(username)) > 0;

create index if not exists students_trainer_created_idx
on public.students (trainer_id, created_at desc);

create index if not exists students_consultancy_idx
on public.students (consultancy_id);

create index if not exists students_auth_user_idx
on public.students (auth_user_id);

create table if not exists public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  trainer_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'general',
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint student_notifications_title_length check (char_length(trim(title)) >= 2)
);

create index if not exists student_notifications_student_unread_idx
on public.student_notifications (student_id, is_read, created_at desc);

create index if not exists student_notifications_trainer_unread_idx
on public.student_notifications (trainer_id, is_read, created_at desc);

alter table public.students enable row level security;
alter table public.student_notifications enable row level security;

grant select on public.students to authenticated;
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

grant select on public.student_notifications to authenticated;
grant update (is_read, read_at) on public.student_notifications to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'students'
      and policyname = 'Trainers and own students can read students'
  ) then
    create policy "Trainers and own students can read students"
    on public.students
    for select
    to authenticated
    using (
      auth_user_id = (select auth.uid())
      or (
        trainer_id = (select auth.uid())
        and exists (
          select 1
          from public.profiles
          where id = (select auth.uid())
            and role = 'trainer'
        )
      )
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'students'
      and policyname = 'Trainers can update their students'
  ) then
    create policy "Trainers can update their students"
    on public.students
    for update
    to authenticated
    using (
      trainer_id = (select auth.uid())
      and exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and role = 'trainer'
      )
    )
    with check (
      trainer_id = (select auth.uid())
      and exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and role = 'trainer'
      )
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'student_notifications'
      and policyname = 'Trainers and own students can read notifications'
  ) then
    create policy "Trainers and own students can read notifications"
    on public.student_notifications
    for select
    to authenticated
    using (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_notifications.student_id
          and students.auth_user_id = (select auth.uid())
      )
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'student_notifications'
      and policyname = 'Trainers and own students can mark notifications read'
  ) then
    create policy "Trainers and own students can mark notifications read"
    on public.student_notifications
    for update
    to authenticated
    using (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_notifications.student_id
          and students.auth_user_id = (select auth.uid())
      )
    )
    with check (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_notifications.student_id
          and students.auth_user_id = (select auth.uid())
      )
    );
  end if;
end;
$$;

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

do $$ 
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Student profile media can be uploaded by student or trainer'
  ) then
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
  end if;
end;
$$;

do $$ 
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Student profile media can be updated by student or trainer'
  ) then
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
  end if;
end;
$$;

do $$ 
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Student profile media can be deleted by student or trainer'
  ) then
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
  end if;
end;
$$;
