-- Melhorias do chat: resposta de mensagem, marcar como importante e figurinha com imagem.

alter table public.student_chat_messages
  add column if not exists reply_to_message_id uuid references public.student_chat_messages(id) on delete set null,
  add column if not exists is_starred boolean not null default false;

alter table public.student_chat_messages
  drop constraint if exists student_chat_has_content;

alter table public.student_chat_messages
  add constraint student_chat_has_content check (
    (message_type = 'text' and body is not null and char_length(trim(body)) >= 1)
    or (
      message_type = 'sticker'
      and (
        (body is not null and char_length(trim(body)) >= 1)
        or media_path is not null
      )
    )
    or (message_type in ('image', 'audio') and media_path is not null)
  );

create index if not exists student_chat_messages_reply_idx
on public.student_chat_messages (reply_to_message_id);

create index if not exists student_chat_messages_consultancy_idx
on public.student_chat_messages (consultancy_id);

create index if not exists student_chat_messages_sender_idx
on public.student_chat_messages (sender_id);

create index if not exists student_chat_messages_starred_idx
on public.student_chat_messages (student_id, is_starred, created_at desc);

grant update (is_starred) on public.student_chat_messages to authenticated;

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
