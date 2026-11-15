# SolveTrack

Платформа подготовки к олимпиадам по физике: пробный экзамен, рейтинг и дивизионы, недельные контесты, задачи с AI-ментором (hint-first), дорожная карта.

Сайт: https://tolegenislambek022-hash.github.io/solvetrack/

## Устройство

| Часть | Где | Файл |
|---|---|---|
| Сайт (одна страница) | GitHub Pages, ветка `gh-pages` | `index.html` |
| Аккаунты, прогресс, рейтинг | Supabase (Auth + Postgres) | `supabase/schema.sql` |
| ИИ (Gemini, запасной — Groq) | Supabase Edge Function `groq` | `supabase/functions/groq/index.ts` |

Ключи ИИ хранятся только в секретах Supabase `GEMINI_API_KEY` (основной) и `GROQ_API_KEY` (запасной, необязательно). В коде сайта их нет.
Адрес проекта Supabase и publishable key в `index.html` не секретные: данные защищают правила RLS из `schema.sql`.

## Первоначальная настройка Supabase

1. **SQL Editor → New query** → вставить `supabase/schema.sql` → **Run**.
2. **Authentication → URL Configuration**:
   - Site URL: `https://tolegenislambek022-hash.github.io/solvetrack/`
   - Redirect URLs: `https://tolegenislambek022-hash.github.io/solvetrack/**`
3. **Edge Functions → Deploy a new function → Via Editor**, имя `groq`, вставить `supabase/functions/groq/index.ts`, выключить **Verify JWT** (проверка входа сделана внутри функции), **Deploy**.
4. **Edge Functions → Secrets**: `GEMINI_API_KEY` = ключ из aistudio.google.com; по желанию `GROQ_API_KEY` = ключ с console.groq.com (запасной ИИ).
5. Почта: встроенная почта Supabase отправляет письма только участникам команды проекта. Для учеников подключить свой SMTP (**Authentication → Emails → SMTP Settings**) или временно выключить подтверждение почты (**Authentication → Sign In / Providers → Email → Confirm email**).

## Вход через Google

1. console.cloud.google.com → новый проект → **Google Auth Platform** → **Get started** (имя приложения, почта, Audience: External).
2. **Clients → Create client → Web application**. Authorized redirect URIs: `https://epuhxplzcqcbztrlxtwg.supabase.co/auth/v1/callback`. Скопировать Client ID и Client Secret.
3. **Audience → Publish app**, чтобы входить мог любой Google-аккаунт.
4. Supabase → **Authentication → Sign In / Providers → Google**: включить, вставить Client ID и Client Secret, **Save**.
