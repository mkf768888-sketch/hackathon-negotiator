# Как задеплоить (простыми словами)

Три части: бэкенд (мозги, ИИ) → Render. Сайт (то, что видит пользователь) → Vercel. Аккаунты компаний → Supabase.

**Известная проблема:** если Vercel при нажатии Redeploy пишет «Git author ... must have access to the team's projects... Hobby teams do not support collaboration» — это значит, что у git на компьютере автоматически выставился случайный email (не привязанный к аккаунту GitHub/Vercel), и Vercel принимает коммит за постороннего. Чинится один раз командой `git config --global user.email "ваш-настоящий-email"` — новые коммиты после этого пройдут нормально.

## 1. Бэкенд на Render

1. Зайти на [render.com](https://render.com), зарегистрироваться (можно через GitHub).
2. New → Blueprint → выбрать этот репозиторий (в нём уже лежит файл `render.yaml`, Render сам поймёт, что и как собирать).
3. Render попросит вписать несколько секретных значений (они помечены `sync: false` в `render.yaml`, поэтому не хранятся в самом репозитории):
   - `DEEPSEEK_API_KEY` — ключ от DeepSeek (уже есть в `backend/.env`).
   - `ANTHROPIC_API_KEY` — ключ от Anthropic, если решите его завести (см. память проекта — раньше сознательно отказались из-за цены).
   - `FRONTEND_ORIGIN` — сюда позже впишете адрес сайта с Vercel (шаг 2), например `https://ваш-проект.vercel.app`.
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — для аккаунтов компаний (шаг 3); без них бэкенд просто не пишет историю сессий в Supabase, всё остальное работает как обычно.
4. Нажать Deploy. Через пару минут появится адрес вида `https://hackathon-negotiator-backend.onrender.com` — это и есть бэкенд.

## 2. Сайт на Vercel

**Важная находка:** в папке `frontend/.vercel/` уже лежит файл со связкой на существующий проект Vercel (`projectName: "frontend"`) — похоже, кто-то уже начинал это подключать раньше. Значит, скорее всего, достаточно просто зайти на [vercel.com](https://vercel.com) под тем же аккаунтом и проверить, есть ли там проект с этим именем, а не создавать новый с нуля.

**Ещё одна находка (23.09.2026):** у этого старого проекта Git был не подключён вообще (висел только ручной деплой от 21 августа) — исправляется через Project Settings → Git → Connect. Также **Root Directory** там стоял `./` по умолчанию — обязательно поменять на `frontend` в Project Settings → Build and Deployment, иначе Vercel будет пытаться собрать репозиторий целиком, а не папку сайта.

1. Зайти на [vercel.com](https://vercel.com), проверить существующие проекты (см. находку выше) или Add New → Project → выбрать репозиторий.
2. Root Directory — указать `frontend` (это важно, репозиторий не только фронтенд).
3. Environment Variables:
   - `VITE_API_BASE` — адрес бэкенда с шага 1 (например `https://hackathon-negotiator-backend.onrender.com`).
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — для аккаунтов компаний (шаг 3).
   - `VITE_AVATAR_MODE` — `photo` (боевой режим, фотопортрет с вспышками эмоций — см. шаг 4); оставить пустым для 3D-рига на Three.js или поставить `video`, если когда-нибудь подключите видео-ролики (компонент есть, роликов нет).
4. Deploy. Получите адрес вида `https://ваш-проект.vercel.app` — это и есть сайт для жюри.
5. Вернуться на Render (шаг 1) и вписать этот адрес в `FRONTEND_ORIGIN`.

## 3. Аккаунты компаний через Supabase

Без этого шага всё работает как раньше — просто без входа и без истории сессий компании.

1. Зайти на [supabase.com](https://supabase.com), создать новый проект (бесплатный tier достаточно).
2. В Supabase Dashboard → SQL Editor → выполнить **по очереди, в этом порядке**, все три файла из `backend/supabase/migrations/`: `0001_init.sql` (таблицы компаний/сотрудников/сессий), `0002_company_signup_insert_policies.sql` (без него регистрация компании молча не срабатывает — RLS блокирует запись), `0003_fix_company_members_recursion.sql` (без него дашборд компании падает с ошибкой «infinite recursion detected in policy»). Все три обязательны, не только первый.
3. В Supabase Dashboard → Project Settings → API найти значения и вписать их в Render/Vercel (шаги 1-2):
   - `Project URL` → это `SUPABASE_URL` (Render) и `VITE_SUPABASE_URL` (Vercel).
   - публичный ключ (`anon public` / новый формат `sb_publishable_...`) → это `VITE_SUPABASE_ANON_KEY` (Vercel).
   - секретный ключ (`service_role` / новый формат `sb_secret_...`, не путать с публичным!) → это `SUPABASE_SERVICE_ROLE_KEY` (Render).
4. `SUPABASE_JWT_SECRET` больше не нужен — бэкенд проверяет подпись токена через публичный JWKS проекта (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`), это работает и со старыми, и с новыми (асимметричными) ключами Supabase без дополнительной настройки.
5. После того как все значения вписаны и оба сервиса передеплоены — на сайте появится экран входа с кнопкой «Зарегистрироваться» (для компании) и «Пропустить и пройти как гость» (демо-режим без изменений).

## 4. Фото-лицо аватара (боевой режим на проде)

Уже сделано и закоммичено — 8 файлов (`idle.jpg` + по одному на каждую из 7
эмоций Экмана, сгенерированное, не настоящее лицо) лежат в
`frontend/public/avatar-photos/`. Просто убедиться, что
`VITE_AVATAR_MODE=photo` стоит в Vercel (шаг 2) — и
всё работает без дополнительных действий. Компонент для видео-роликов
(`AvatarVideo.jsx`) в коде тоже есть, но самих роликов нет — если захотите
подключить, см. `VITE_AVATAR_MODE=video` в шаге 2 и положите `.mp4`-файлы
с теми же именами в `frontend/public/avatar-clips/`.

## Локальная проверка перед деплоем

Бэкенд: `cd backend && ../.venv/bin/python3.11 -m uvicorn server:app --reload` (если venv снова сломан — см. память проекта про битые shebang-пути, обходной путь тот же).
Фронтенд: `cd frontend && npm install && npm run dev`.
