-- SolveTrack: настройки сайта (флаг «демо-участники» для стенда).
-- Выполнить один раз ПОСЛЕ admin.sql: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Читать настройки может любой посетитель; менять — только админ (public.is_admin()).

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;

drop policy if exists "settings read" on public.site_settings;
create policy "settings read" on public.site_settings for select to anon, authenticated using (true);

drop policy if exists "settings admin write" on public.site_settings;
create policy "settings admin write" on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

insert into public.site_settings (key, value) values ('demo_users', '{"on": false}')
on conflict (key) do nothing;
