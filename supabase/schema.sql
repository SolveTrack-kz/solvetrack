-- SolveTrack: схема базы данных.
-- Как применить: Supabase → SQL Editor → New query → вставить весь этот файл → Run.
-- Скрипт можно запускать повторно: он ничего не удаляет из данных.

-- 1. Профили: то, что видно в общем рейтинге
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  grade       text,
  role        text not null default 'student' check (role in ('student','teacher','mentor')),
  school      text not null default '',
  rating      integer,
  division    integer generated always as (
                case when rating is null then null
                     when rating >= 1500 then 1
                     when rating >= 1100 then 2
                     else 3 end) stored,
  contests    integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- 2. Личные данные ученика (прогресс, чаты, тесты): видит только он сам
create table if not exists public.user_state (
  id          uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 3. Защита строк: каждый меняет только своё
alter table public.profiles   enable row level security;
alter table public.user_state enable row level security;

drop policy if exists "profiles: read for signed-in" on public.profiles;
create policy "profiles: read for signed-in" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "user_state: own only" on public.user_state;
create policy "user_state: own only" on public.user_state
  for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

grant select, insert, update on public.profiles   to authenticated;
grant select, insert, update on public.user_state to authenticated;
revoke all on public.profiles   from anon;
revoke all on public.user_state from anon;

create index if not exists profiles_rating_idx on public.profiles (rating desc nulls last);

-- 4. При регистрации автоматически создаём профиль и пустой прогресс
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r text := new.raw_user_meta_data->>'role';
begin
  insert into public.profiles (id, name, grade, role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'name', ''), 60),
    left(new.raw_user_meta_data->>'grade', 10),
    case when r in ('student','teacher','mentor') then r else 'student' end
  )
  on conflict (id) do nothing;

  insert into public.user_state (id) values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
