-- Registros de cardio do aluno.
-- Alunos registram manualmente ou por cronometro; treinadores acompanham pelo painel.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists public.student_cardio_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  trainer_id uuid not null references auth.users(id) on delete cascade,
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  training_plan_id uuid references public.student_training_plans(id) on delete set null,
  log_date date not null default current_date,
  source text not null default 'manual',
  modality text not null default 'Cardio',
  intensity text not null default 'moderate',
  duration_seconds integer not null,
  started_at timestamptz,
  completed_at timestamptz,
  distance_km numeric(7, 2),
  calories integer,
  notes text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_cardio_logs_source_check check (source in ('manual', 'timer')),
  constraint student_cardio_logs_intensity_check check (intensity in ('light', 'moderate', 'vigorous')),
  constraint student_cardio_logs_duration_check check (duration_seconds > 0),
  constraint student_cardio_logs_distance_check check (distance_km is null or distance_km >= 0),
  constraint student_cardio_logs_calories_check check (calories is null or calories >= 0),
  constraint student_cardio_logs_modality_check check (length(trim(modality)) > 0)
);

create index if not exists student_cardio_logs_student_date_idx
on public.student_cardio_logs (student_id, log_date desc, created_at desc);

create index if not exists student_cardio_logs_trainer_date_idx
on public.student_cardio_logs (trainer_id, log_date desc);

create index if not exists student_cardio_logs_consultancy_idx
on public.student_cardio_logs (consultancy_id);

create index if not exists student_cardio_logs_plan_idx
on public.student_cardio_logs (training_plan_id);

create index if not exists student_cardio_logs_created_by_idx
on public.student_cardio_logs (created_by);

alter table public.student_cardio_logs enable row level security;

grant select, insert on public.student_cardio_logs to authenticated;
grant update (
  training_plan_id,
  log_date,
  source,
  modality,
  intensity,
  duration_seconds,
  started_at,
  completed_at,
  distance_km,
  calories,
  notes,
  updated_at
) on public.student_cardio_logs to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_cardio_logs'
      and policyname = 'Trainers and own students can read cardio logs'
  ) then
    create policy "Trainers and own students can read cardio logs"
    on public.student_cardio_logs
    for select
    to authenticated
    using (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_cardio_logs.student_id
          and students.auth_user_id = (select auth.uid())
      )
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_cardio_logs'
      and policyname = 'Trainers and own students can create cardio logs'
  ) then
    create policy "Trainers and own students can create cardio logs"
    on public.student_cardio_logs
    for insert
    to authenticated
    with check (
      created_by = (select auth.uid())
      and exists (
        select 1
        from public.students
        where students.id = student_cardio_logs.student_id
          and students.trainer_id = student_cardio_logs.trainer_id
          and students.consultancy_id = student_cardio_logs.consultancy_id
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
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_cardio_logs'
      and policyname = 'Trainers and own students can update cardio logs'
  ) then
    create policy "Trainers and own students can update cardio logs"
    on public.student_cardio_logs
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.students
        where students.id = student_cardio_logs.student_id
          and (
            students.trainer_id = (select auth.uid())
            or students.auth_user_id = (select auth.uid())
          )
      )
    )
    with check (
      exists (
        select 1
        from public.students
        where students.id = student_cardio_logs.student_id
          and students.trainer_id = student_cardio_logs.trainer_id
          and students.consultancy_id = student_cardio_logs.consultancy_id
          and (
            students.trainer_id = (select auth.uid())
            or students.auth_user_id = (select auth.uid())
          )
      )
    );
  end if;
end;
$$;

create or replace function private.set_student_cardio_logs_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_cardio_logs_updated_at on public.student_cardio_logs;
create trigger set_student_cardio_logs_updated_at
before update on public.student_cardio_logs
for each row
execute function private.set_student_cardio_logs_updated_at();
