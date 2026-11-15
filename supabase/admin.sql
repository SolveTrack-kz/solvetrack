-- SolveTrack: доступ администратора.
-- Выполнить один раз: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- В последней строке замените адрес почты на свой (той почтой вы входите на сайт).

-- 1. Список администраторов
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security;
drop policy if exists "admins see themselves" on public.admins;
create policy "admins see themselves" on public.admins
  for select to authenticated using (user_id = auth.uid());
revoke all on public.admins from anon;
grant select on public.admins to authenticated;

-- 2. Проверка «я админ?»
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 3. Админ может читать прогресс всех учеников (ученики по-прежнему видят только себя)
drop policy if exists "admins read all state" on public.user_state;
create policy "admins read all state" on public.user_state
  for select to authenticated using (public.is_admin());

-- 4. Список аккаунтов с почтой и датами — только для админа
create or replace function public.admin_users()
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, provider text, confirmed boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'not admin' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
           coalesce(u.raw_app_meta_data->>'provider', 'email'), u.email_confirmed_at is not null
    from auth.users u
    order by u.created_at desc;
end;
$$;
revoke execute on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

-- 5. Сделать себя админом: впишите свою почту вместо примера
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower('ВАША_ПОЧТА@gmail.com')
on conflict do nothing;

-- Проверка: должна появиться одна строка с вашей почтой
select a.user_id, u.email from public.admins a join auth.users u on u.id = a.user_id;
