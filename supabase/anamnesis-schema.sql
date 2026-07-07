-- Anamnese do aluno: respostas iniciais, progresso e preferencia de exibicao.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists public.student_anamneses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  trainer_id uuid not null references auth.users(id) on delete cascade,
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  status text not null default 'draft',
  answers jsonb not null default '{}'::jsonb,
  dismissed_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_anamneses_status_check check (status in ('draft', 'completed')),
  constraint student_anamneses_answers_object check (jsonb_typeof(answers) = 'object')
);

create index if not exists student_anamneses_student_idx
on public.student_anamneses (student_id);

create index if not exists student_anamneses_trainer_status_idx
on public.student_anamneses (trainer_id, status, updated_at desc);

create index if not exists student_anamneses_consultancy_idx
on public.student_anamneses (consultancy_id);

create index if not exists student_anamneses_created_by_idx
on public.student_anamneses (created_by);

alter table public.student_anamneses enable row level security;

grant select, insert on public.student_anamneses to authenticated;
grant update (
  status,
  answers,
  dismissed_at,
  completed_at,
  updated_at
) on public.student_anamneses to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_anamneses'
      and policyname = 'Trainers and own students can read anamneses'
  ) then
    create policy "Trainers and own students can read anamneses"
    on public.student_anamneses
    for select
    to authenticated
    using (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_anamneses.student_id
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
      and tablename = 'student_anamneses'
      and policyname = 'Trainers and own students can create anamneses'
  ) then
    create policy "Trainers and own students can create anamneses"
    on public.student_anamneses
    for insert
    to authenticated
    with check (
      created_by = (select auth.uid())
      and exists (
        select 1
        from public.students
        where students.id = student_anamneses.student_id
          and students.trainer_id = student_anamneses.trainer_id
          and students.consultancy_id = student_anamneses.consultancy_id
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
      and tablename = 'student_anamneses'
      and policyname = 'Trainers and own students can update anamneses'
  ) then
    create policy "Trainers and own students can update anamneses"
    on public.student_anamneses
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.students
        where students.id = student_anamneses.student_id
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
        where students.id = student_anamneses.student_id
          and students.trainer_id = student_anamneses.trainer_id
          and students.consultancy_id = student_anamneses.consultancy_id
          and (
            students.trainer_id = (select auth.uid())
            or students.auth_user_id = (select auth.uid())
          )
      )
    );
  end if;
end;
$$;

create or replace function private.set_student_anamneses_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_anamneses_updated_at on public.student_anamneses;
create trigger set_student_anamneses_updated_at
before update on public.student_anamneses
for each row
execute function private.set_student_anamneses_updated_at();
