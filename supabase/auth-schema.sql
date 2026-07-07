-- Execute este SQL no Supabase SQL Editor ou aplique como migration.
-- Ele cria perfis publicos protegidos por RLS e mantem signup publico apenas para treinadores.

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'user_role') then
    create type public.user_role as enum ('trainer', 'student');
  end if;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'trainer',
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can read their own profile'
  ) then
    create policy "Users can read their own profile"
    on public.profiles
    for select
    to authenticated
    using ((select auth.uid()) = id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update editable fields on their own profile'
  ) then
    create policy "Users can update editable fields on their own profile"
    on public.profiles
    for update
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);
  end if;
end;
$$;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create or replace function private.set_current_timestamp_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function private.set_current_timestamp_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role := 'trainer';
begin
  if new.raw_app_meta_data ? 'role'
    and new.raw_app_meta_data->>'role' in ('trainer', 'student') then
    requested_role := (new.raw_app_meta_data->>'role')::public.user_role;
  end if;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    requested_role,
    nullif(trim(new.raw_user_meta_data->>'full_name'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

drop function if exists public.handle_new_user();
drop function if exists public.set_current_timestamp_updated_at();
