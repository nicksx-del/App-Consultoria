-- Chat funcional por aluno.
-- Treinador e aluno vinculado conversam; midias ficam em bucket privado com URLs assinadas.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'chat_sender_role') then
    create type public.chat_sender_role as enum ('trainer', 'student');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'chat_message_type') then
    create type public.chat_message_type as enum ('text', 'image', 'audio', 'sticker');
  end if;
end;
$$;

create table if not exists public.student_chat_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  trainer_id uuid not null references auth.users(id) on delete cascade,
  consultancy_id uuid not null references public.consultancies(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role public.chat_sender_role not null,
  message_type public.chat_message_type not null default 'text',
  body text,
  media_path text,
  media_mime_type text,
  media_size integer,
  audio_duration_seconds integer,
  reply_to_message_id uuid references public.student_chat_messages(id) on delete set null,
  is_starred boolean not null default false,
  created_at timestamptz not null default now(),
  constraint student_chat_has_content check (
    (message_type = 'text' and body is not null and char_length(trim(body)) >= 1)
    or (
      message_type = 'sticker'
      and (
        (body is not null and char_length(trim(body)) >= 1)
        or media_path is not null
      )
    )
    or (message_type in ('image', 'audio') and media_path is not null)
  ),
  constraint student_chat_media_size_positive check (media_size is null or media_size > 0),
  constraint student_chat_audio_duration_positive check (audio_duration_seconds is null or audio_duration_seconds >= 0)
);

create index if not exists student_chat_messages_student_created_idx
on public.student_chat_messages (student_id, created_at desc);

create index if not exists student_chat_messages_trainer_created_idx
on public.student_chat_messages (trainer_id, created_at desc);

create index if not exists student_chat_messages_consultancy_idx
on public.student_chat_messages (consultancy_id);

create index if not exists student_chat_messages_sender_idx
on public.student_chat_messages (sender_id);

create index if not exists student_chat_messages_reply_idx
on public.student_chat_messages (reply_to_message_id);

create index if not exists student_chat_messages_starred_idx
on public.student_chat_messages (student_id, is_starred, created_at desc);

alter table public.student_chat_messages enable row level security;

grant select, insert on public.student_chat_messages to authenticated;
grant update (is_starred) on public.student_chat_messages to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'student_chat_messages'
      and policyname = 'Trainers and own students can read chat messages'
  ) then
    create policy "Trainers and own students can read chat messages"
    on public.student_chat_messages
    for select
    to authenticated
    using (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_chat_messages.student_id
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
      and tablename = 'student_chat_messages'
      and policyname = 'Trainers and own students can insert chat messages'
  ) then
    create policy "Trainers and own students can insert chat messages"
    on public.student_chat_messages
    for insert
    to authenticated
    with check (
      sender_id = (select auth.uid())
      and exists (
        select 1
        from public.students
        where students.id = student_chat_messages.student_id
          and students.trainer_id = student_chat_messages.trainer_id
          and students.consultancy_id = student_chat_messages.consultancy_id
          and (
            (
              students.trainer_id = (select auth.uid())
              and student_chat_messages.sender_role = 'trainer'
              and exists (
                select 1
                from public.profiles
                where profiles.id = (select auth.uid())
                  and profiles.role = 'trainer'
              )
            )
            or (
              students.auth_user_id = (select auth.uid())
              and student_chat_messages.sender_role = 'student'
            )
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
      and tablename = 'student_chat_messages'
      and policyname = 'Trainers and own students can mark chat messages'
  ) then
    create policy "Trainers and own students can mark chat messages"
    on public.student_chat_messages
    for update
    to authenticated
    using (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_chat_messages.student_id
          and students.auth_user_id = (select auth.uid())
      )
    )
    with check (
      trainer_id = (select auth.uid())
      or exists (
        select 1
        from public.students
        where students.id = student_chat_messages.student_id
          and students.auth_user_id = (select auth.uid())
      )
    );
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  20971520,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'audio/m4a',
    'audio/mp4',
    'audio/mpeg',
    'audio/webm',
    'audio/aac',
    'audio/3gpp'
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
      and policyname = 'Chat participants can read chat media'
  ) then
    create policy "Chat participants can read chat media"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'chat-media'
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
      and policyname = 'Chat participants can upload chat media'
  ) then
    create policy "Chat participants can upload chat media"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'chat-media'
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
      and policyname = 'Chat senders can delete their own chat media'
  ) then
    create policy "Chat senders can delete their own chat media"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'chat-media'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    );
  end if;
end;
$$;
