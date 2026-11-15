# SolveTrack

Платформа подготовки к олимпиадам по физике: пробный экзамен, рейтинг и дивизионы, недельные контесты, задачи с AI-ментором (hint-first), дорожная карта.

Сайт: https://tolegenislambek022-hash.github.io/solvetrack/

## Устройство

| Часть | Где | Файл |
|---|---|---|
| Сайт (одна страница) | GitHub Pages, ветка `gh-pages` | `index.html` |
| Аккаунты, прогресс, рейтинг | Supabase (Auth + Postgres) | `supabase/schema.sql` |
| ИИ (Groq) | Supabase Edge Function `groq` | `supabase/functions/groq/index.ts` |

Ключ Groq хранится только в секрете Supabase `GROQ_API_KEY`. В коде сайта его нет.
Адрес проекта Supabase и publishable key в `index.html` не секретные: данные защищают правила RLS из `schema.sql`.

## Первоначальная настройка Supabase

1. **SQL Editor → New query** → вставить `supabase/schema.sql` → **Run**.
2. **Authentication → URL Configuration**:
   - Site URL: `https://tolegenislambek022-hash.github.io/solvetrack/`
   - Redirect URLs: `https://tolegenislambek022-hash.github.io/solvetrack/**`
3. **Edge Functions → Deploy a new function → Via Editor**, имя `groq`, вставить `supabase/functions/groq/index.ts`, выключить **Verify JWT** (проверка входа сделана внутри функции), **Deploy**.
4. **Edge Functions → Secrets**: `GROQ_API_KEY` = ключ с console.groq.com.
5. Почта: встроенная почта Supabase отправляет письма только участникам команды проекта. Для учеников подключить свой SMTP (**Authentication → Emails → SMTP Settings**) или временно выключить подтверждение почты (**Authentication → Sign In / Providers → Email → Confirm email**).
