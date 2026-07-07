-- Estrutura funcional dos planos alimentares por aluno.
-- Treinadores editam as dietas dos seus alunos; alunos apenas leem o proprio plano.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists public.student_nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  trainer_id uuid not null references auth.users(id) on delete cascade,
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  phases jsonb not null default '[]'::jsonb,
  meals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_nutrition_config_object check (jsonb_typeof(config) = 'object'),
  constraint student_nutrition_phases_array check (jsonb_typeof(phases) = 'array'),
  constraint student_nutrition_meals_array check (jsonb_typeof(meals) = 'array')
);

create index if not exists student_nutrition_plans_trainer_idx
on public.student_nutrition_plans (trainer_id, updated_at desc);

create index if not exists student_nutrition_plans_consultancy_idx
on public.student_nutrition_plans (consultancy_id);

alter table public.student_nutrition_plans enable row level security;

grant select, insert, delete on public.student_nutrition_plans to authenticated;
grant update (
  config,
  phases,
  meals,
  updated_at
) on public.student_nutrition_plans to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'student_nutrition_plans'
      and policyname = 'Trainers and own students can read nutrition plans'
  ) then
    create policy "Trainers and own students can read nutrition plans"
    on public.student_nutrition_plans
    for select
    to authenticated
    using (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_nutrition_plans.student_id
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
      and tablename = 'student_nutrition_plans'
      and policyname = 'Trainers can insert nutrition plans for their students'
  ) then
    create policy "Trainers can insert nutrition plans for their students"
    on public.student_nutrition_plans
    for insert
    to authenticated
    with check (
      trainer_id = (select auth.uid())
      and exists (
        select 1
        from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.role = 'trainer'
      )
      and exists (
        select 1
        from public.students
        where students.id = student_nutrition_plans.student_id
          and students.trainer_id = (select auth.uid())
          and students.consultancy_id = student_nutrition_plans.consultancy_id
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
      and tablename = 'student_nutrition_plans'
      and policyname = 'Trainers can update nutrition plans for their students'
  ) then
    create policy "Trainers can update nutrition plans for their students"
    on public.student_nutrition_plans
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
        from public.students
        where students.id = student_nutrition_plans.student_id
          and students.trainer_id = (select auth.uid())
          and students.consultancy_id = student_nutrition_plans.consultancy_id
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
      and tablename = 'student_nutrition_plans'
      and policyname = 'Trainers can delete nutrition plans for their students'
  ) then
    create policy "Trainers can delete nutrition plans for their students"
    on public.student_nutrition_plans
    for delete
    to authenticated
    using (
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

create or replace function private.set_student_nutrition_plans_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_nutrition_plans_updated_at on public.student_nutrition_plans;

create trigger set_student_nutrition_plans_updated_at
before update on public.student_nutrition_plans
for each row
execute function private.set_student_nutrition_plans_updated_at();
