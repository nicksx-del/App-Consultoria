-- Execucao do aluno: sessoes de treino e marcacao de refeicoes.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'workout_session_status') then
    create type public.workout_session_status as enum ('in_progress', 'completed');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'meal_log_status') then
    create type public.meal_log_status as enum ('planned', 'eaten', 'partial', 'skipped');
  end if;
end;
$$;

create table if not exists public.student_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  trainer_id uuid not null references auth.users(id) on delete cascade,
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  training_plan_id uuid references public.student_training_plans(id) on delete set null,
  workout_day_id text not null,
  workout_day_name text not null,
  status public.workout_session_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer,
  exercise_logs jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_workout_sessions_duration_check check (duration_seconds is null or duration_seconds >= 0),
  constraint student_workout_sessions_logs_array check (jsonb_typeof(exercise_logs) = 'array'),
  constraint student_workout_sessions_name_check check (length(trim(workout_day_name)) > 0)
);

create index if not exists student_workout_sessions_student_started_idx
on public.student_workout_sessions (student_id, started_at desc);

create index if not exists student_workout_sessions_trainer_status_idx
on public.student_workout_sessions (trainer_id, status, started_at desc);

create index if not exists student_workout_sessions_plan_idx
on public.student_workout_sessions (training_plan_id);

create index if not exists student_workout_sessions_consultancy_idx
on public.student_workout_sessions (consultancy_id);

create index if not exists student_workout_sessions_created_by_idx
on public.student_workout_sessions (created_by);

alter table public.student_workout_sessions enable row level security;

grant select, insert, update on public.student_workout_sessions to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_workout_sessions'
      and policyname = 'Trainers and own students can read workout sessions'
  ) then
    create policy "Trainers and own students can read workout sessions"
    on public.student_workout_sessions
    for select
    to authenticated
    using (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_workout_sessions.student_id
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
      and tablename = 'student_workout_sessions'
      and policyname = 'Trainers and own students can create workout sessions'
  ) then
    create policy "Trainers and own students can create workout sessions"
    on public.student_workout_sessions
    for insert
    to authenticated
    with check (
      created_by = (select auth.uid())
      and exists (
        select 1
        from public.students
        where students.id = student_workout_sessions.student_id
          and students.trainer_id = student_workout_sessions.trainer_id
          and students.consultancy_id = student_workout_sessions.consultancy_id
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
      and tablename = 'student_workout_sessions'
      and policyname = 'Trainers and own students can update workout sessions'
  ) then
    create policy "Trainers and own students can update workout sessions"
    on public.student_workout_sessions
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.students
        where students.id = student_workout_sessions.student_id
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
        where students.id = student_workout_sessions.student_id
          and students.trainer_id = student_workout_sessions.trainer_id
          and students.consultancy_id = student_workout_sessions.consultancy_id
          and (
            students.trainer_id = (select auth.uid())
            or students.auth_user_id = (select auth.uid())
          )
      )
    );
  end if;
end;
$$;

create table if not exists public.student_meal_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  trainer_id uuid not null references auth.users(id) on delete cascade,
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  nutrition_plan_id uuid references public.student_nutrition_plans(id) on delete set null,
  meal_id text not null,
  meal_name text not null,
  log_date date not null default current_date,
  weekday text not null,
  status public.meal_log_status not null default 'planned',
  totals jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_meal_logs_meal_name_check check (length(trim(meal_name)) > 0),
  constraint student_meal_logs_weekday_check check (
    weekday in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
  ),
  constraint student_meal_logs_totals_object check (jsonb_typeof(totals) = 'object'),
  constraint student_meal_logs_unique_day unique (student_id, log_date, meal_id)
);

create index if not exists student_meal_logs_student_date_idx
on public.student_meal_logs (student_id, log_date desc);

create index if not exists student_meal_logs_trainer_date_idx
on public.student_meal_logs (trainer_id, log_date desc);

create index if not exists student_meal_logs_plan_idx
on public.student_meal_logs (nutrition_plan_id);

create index if not exists student_meal_logs_consultancy_idx
on public.student_meal_logs (consultancy_id);

alter table public.student_meal_logs enable row level security;

grant select, insert, update on public.student_meal_logs to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_meal_logs'
      and policyname = 'Trainers and own students can read meal logs'
  ) then
    create policy "Trainers and own students can read meal logs"
    on public.student_meal_logs
    for select
    to authenticated
    using (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_meal_logs.student_id
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
      and tablename = 'student_meal_logs'
      and policyname = 'Trainers and own students can create meal logs'
  ) then
    create policy "Trainers and own students can create meal logs"
    on public.student_meal_logs
    for insert
    to authenticated
    with check (
      exists (
        select 1
        from public.students
        where students.id = student_meal_logs.student_id
          and students.trainer_id = student_meal_logs.trainer_id
          and students.consultancy_id = student_meal_logs.consultancy_id
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
      and tablename = 'student_meal_logs'
      and policyname = 'Trainers and own students can update meal logs'
  ) then
    create policy "Trainers and own students can update meal logs"
    on public.student_meal_logs
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.students
        where students.id = student_meal_logs.student_id
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
        where students.id = student_meal_logs.student_id
          and students.trainer_id = student_meal_logs.trainer_id
          and students.consultancy_id = student_meal_logs.consultancy_id
          and (
            students.trainer_id = (select auth.uid())
            or students.auth_user_id = (select auth.uid())
          )
      )
    );
  end if;
end;
$$;

create or replace function private.set_student_execution_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_workout_sessions_updated_at on public.student_workout_sessions;
create trigger set_student_workout_sessions_updated_at
before update on public.student_workout_sessions
for each row
execute function private.set_student_execution_updated_at();

drop trigger if exists set_student_meal_logs_updated_at on public.student_meal_logs;
create trigger set_student_meal_logs_updated_at
before update on public.student_meal_logs
for each row
execute function private.set_student_execution_updated_at();
