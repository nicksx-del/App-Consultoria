-- Cria a estrutura de consultorias dos treinadores e o bucket de imagens.
-- Nesta etapa, cada treinador possui no maximo uma consultoria.

create table if not exists public.consultancies (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  whatsapp text,
  instagram_url text,
  website_url text,
  banner_path text,
  banner_url text,
  image_path text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consultancies_trainer_unique unique (trainer_id),
  constraint consultancies_name_length check (char_length(trim(name)) >= 2)
);

alter table public.consultancies enable row level security;

grant select, insert, update, delete on public.consultancies to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'consultancies'
      and policyname = 'Trainers can read their own consultancy'
  ) then
    create policy "Trainers can read their own consultancy"
    on public.consultancies
    for select
    to authenticated
    using (trainer_id = (select auth.uid()));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'consultancies'
      and policyname = 'Trainers can create their own consultancy'
  ) then
    create policy "Trainers can create their own consultancy"
    on public.consultancies
    for insert
    to authenticated
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
      and tablename = 'consultancies'
      and policyname = 'Trainers can update their own consultancy'
  ) then
    create policy "Trainers can update their own consultancy"
    on public.consultancies
    for update
    to authenticated
    using (trainer_id = (select auth.uid()))
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
      and tablename = 'consultancies'
      and policyname = 'Trainers can delete their own consultancy'
  ) then
    create policy "Trainers can delete their own consultancy"
    on public.consultancies
    for delete
    to authenticated
    using (trainer_id = (select auth.uid()));
  end if;
end;
$$;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create or replace function private.set_consultancies_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_consultancies_updated_at on public.consultancies;

create trigger set_consultancies_updated_at
before update on public.consultancies
for each row
execute function private.set_consultancies_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consultancy-media',
  'consultancy-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
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
      and policyname = 'Public can read consultancy media'
  ) then
    create policy "Public can read consultancy media"
    on storage.objects
    for select
    to public
    using (
      bucket_id = 'consultancy-media'
      and storage.allow_any_operation(array[
        'object.get',
        'object.get_public',
        'storage.object.get',
        'storage.object.get_public',
        'object.get_authenticated',
        'storage.object.get_authenticated'
      ])
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
      and policyname = 'Trainers can upload consultancy media'
  ) then
    create policy "Trainers can upload consultancy media"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'consultancy-media'
      and (storage.foldername(name))[1] = (select auth.uid())::text
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
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Trainers can update their consultancy media'
  ) then
    create policy "Trainers can update their consultancy media"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'consultancy-media'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    with check (
      bucket_id = 'consultancy-media'
      and (storage.foldername(name))[1] = (select auth.uid())::text
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
      and policyname = 'Trainers can delete their consultancy media'
  ) then
    create policy "Trainers can delete their consultancy media"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'consultancy-media'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
  end if;
end;
$$;
