-- Reparo retroativo para contas de aluno antigas sem vinculo auth_user_id.
-- A funcao tenta localizar exatamente um cadastro de aluno pelo e-mail da conta autenticada.
-- Se houver ambiguidade ou conflito, ela falha com um codigo explicito.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create or replace function public.resolve_own_student_account()
returns setof public.students
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  linked_student public.students%rowtype;
  email_candidate public.students%rowtype;
  email_match_count integer := 0;
  profile_name text;
begin
  if current_user_id is null then
    raise exception 'OWN_STUDENT_AUTH_REQUIRED';
  end if;

  select users.email
  into current_email
  from auth.users as users
  where users.id = current_user_id;

  if current_email is null or length(trim(current_email)) = 0 then
    raise exception 'OWN_STUDENT_EMAIL_NOT_FOUND';
  end if;

  select *
  into linked_student
  from public.students
  where auth_user_id = current_user_id;

  if found then
    profile_name := coalesce(nullif(trim(linked_student.full_name), ''), split_part(current_email, '@', 1));

    insert into public.profiles (id, role, full_name)
    values (current_user_id, 'student', profile_name)
    on conflict (id) do update
    set
      role = 'student',
      full_name = case
        when public.profiles.full_name is null or length(trim(public.profiles.full_name)) = 0
          then excluded.full_name
        else public.profiles.full_name
      end,
      updated_at = now();

    return next linked_student;
    return;
  end if;

  select count(*)
  into email_match_count
  from public.students
  where lower(email) = lower(current_email);

  if email_match_count = 0 then
    raise exception 'OWN_STUDENT_NOT_FOUND';
  end if;

  if email_match_count > 1 then
    raise exception 'OWN_STUDENT_AMBIGUOUS';
  end if;

  select *
  into email_candidate
  from public.students
  where lower(email) = lower(current_email)
  limit 1;

  if email_candidate.auth_user_id is not null and email_candidate.auth_user_id <> current_user_id then
    raise exception 'OWN_STUDENT_LINKED_TO_ANOTHER_ACCOUNT';
  end if;

  update public.students
  set
    auth_user_id = current_user_id,
    updated_at = now()
  where id = email_candidate.id
    and (auth_user_id is null or auth_user_id = current_user_id)
  returning * into linked_student;

  if not found then
    raise exception 'OWN_STUDENT_LINK_UPDATE_FAILED';
  end if;

  profile_name := coalesce(nullif(trim(linked_student.full_name), ''), split_part(current_email, '@', 1));

  insert into public.profiles (id, role, full_name)
  values (current_user_id, 'student', profile_name)
  on conflict (id) do update
  set
    role = 'student',
    full_name = case
      when public.profiles.full_name is null or length(trim(public.profiles.full_name)) = 0
        then excluded.full_name
      else public.profiles.full_name
    end,
    updated_at = now();

  return next linked_student;
end;
$$;

grant execute on function public.resolve_own_student_account() to authenticated;
