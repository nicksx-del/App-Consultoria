-- Check-ins semanais com fotos privadas, revisão do treinador e notificação.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'checkin_status') then
    create type public.checkin_status as enum ('pending', 'reviewed', 'adjusted');
  end if;
end;
$$;

create table if not exists public.student_checkins (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  trainer_id uuid not null references auth.users(id) on delete cascade,
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  status public.checkin_status not null default 'pending',
  checkin_date date not null default current_date,
  weight_kg numeric(6, 2),
  waist_cm numeric(6, 2),
  abdomen_cm numeric(6, 2),
  hip_cm numeric(6, 2),
  chest_cm numeric(6, 2),
  arm_cm numeric(6, 2),
  thigh_cm numeric(6, 2),
  diet_adherence integer,
  training_adherence integer,
  cardio_adherence integer,
  sleep_quality integer,
  stress_level integer,
  energy_level integer,
  student_notes text,
  coach_feedback text,
  coach_private_notes text,
  photos jsonb not null default '[]'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_checkins_weight_range check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 400)),
  constraint student_checkins_measure_range check (
    (waist_cm is null or (waist_cm >= 20 and waist_cm <= 250))
    and (abdomen_cm is null or (abdomen_cm >= 20 and abdomen_cm <= 250))
    and (hip_cm is null or (hip_cm >= 20 and hip_cm <= 250))
    and (chest_cm is null or (chest_cm >= 20 and chest_cm <= 250))
    and (arm_cm is null or (arm_cm >= 10 and arm_cm <= 100))
    and (thigh_cm is null or (thigh_cm >= 20 and thigh_cm <= 150))
  ),
  constraint student_checkins_adherence_range check (
    (diet_adherence is null or (diet_adherence >= 0 and diet_adherence <= 100))
    and (training_adherence is null or (training_adherence >= 0 and training_adherence <= 100))
    and (cardio_adherence is null or (cardio_adherence >= 0 and cardio_adherence <= 100))
  ),
  constraint student_checkins_scale_range check (
    (sleep_quality is null or (sleep_quality >= 1 and sleep_quality <= 5))
    and (stress_level is null or (stress_level >= 1 and stress_level <= 5))
    and (energy_level is null or (energy_level >= 1 and energy_level <= 5))
  )
);

alter table public.student_checkins
add column if not exists videos jsonb not null default '[]'::jsonb;

create index if not exists student_checkins_student_date_idx
on public.student_checkins (student_id, checkin_date desc, created_at desc);

create index if not exists student_checkins_trainer_status_idx
on public.student_checkins (trainer_id, status, created_at desc);

create index if not exists student_checkins_consultancy_idx
on public.student_checkins (consultancy_id);

create index if not exists student_checkins_submitted_by_idx
on public.student_checkins (submitted_by);

alter table public.student_checkins enable row level security;

grant select, insert, update on public.student_checkins to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'student_checkins'
      and policyname = 'Trainers and own students can read checkins'
  ) then
    create policy "Trainers and own students can read checkins"
    on public.student_checkins
    for select
    to authenticated
    using (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_checkins.student_id
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
      and tablename = 'student_checkins'
      and policyname = 'Trainers and own students can submit checkins'
  ) then
    create policy "Trainers and own students can submit checkins"
    on public.student_checkins
    for insert
    to authenticated
    with check (
      submitted_by = (select auth.uid())
      and exists (
        select 1
        from public.students
        where students.id = student_checkins.student_id
          and students.trainer_id = student_checkins.trainer_id
          and students.consultancy_id = student_checkins.consultancy_id
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
    where schemaname = 'public'
      and tablename = 'student_checkins'
      and policyname = 'Trainers can review checkins'
  ) then
    create policy "Trainers can review checkins"
    on public.student_checkins
    for update
    to authenticated
    using (
      trainer_id = (select auth.uid())
      and exists (
        select 1
        from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.role = 'trainer'
      )
    )
    with check (
      trainer_id = (select auth.uid())
      and exists (
        select 1
        from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.role = 'trainer'
      )
    );
  end if;
end;
$$;

create or replace function private.set_student_checkins_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_checkins_updated_at on public.student_checkins;

create trigger set_student_checkins_updated_at
before update on public.student_checkins
for each row
execute function private.set_student_checkins_updated_at();

create or replace function private.notify_trainer_new_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_name text;
begin
  if new.submitted_by = new.trainer_id then
    return new;
  end if;

  select full_name
  into student_name
  from public.students
  where id = new.student_id;

  insert into public.student_notifications (student_id, trainer_id, type, title, body)
  values (
    new.student_id,
    new.trainer_id,
    'checkin',
    'Novo check-in',
    coalesce(student_name, 'Aluno') || ' enviou um novo check-in para revisão.'
  );

  return new;
end;
$$;

drop trigger if exists notify_trainer_new_checkin on public.student_checkins;

create trigger notify_trainer_new_checkin
after insert on public.student_checkins
for each row
execute function private.notify_trainer_new_checkin();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checkin-media',
  'checkin-media',
  false,
  524288000,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
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
      and policyname = 'Checkin participants can read checkin media'
  ) then
    create policy "Checkin participants can read checkin media"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'checkin-media'
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
      and policyname = 'Checkin participants can upload checkin media'
  ) then
    create policy "Checkin participants can upload checkin media"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'checkin-media'
      and (storage.foldername(name))[2] = (select auth.uid())::text
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
      and policyname = 'Checkin senders can delete their own checkin media'
  ) then
    create policy "Checkin senders can delete their own checkin media"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'checkin-media'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    );
  end if;
end;
$$;
