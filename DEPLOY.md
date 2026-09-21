# Как задеплоить (простыми словами)

Три части: бэкенд (мозги, ИИ) → Render. Сайт (то, что видит пользователь) → Vercel. Аккаунты компаний (опционально) → Supabase.

## 1. Бэкенд на Render

1. Зайти на [render.com](https://render.com), зарегистрироваться (можно через GitHub).
2. New → Blueprint → выбрать этот репозиторий (в нём уже лежит файл `render.yaml`, Render сам поймёт, что и как собирать).
3. Render попросит вписать несколько секретных значений (они помечены `sync: false` в `render.yaml`, поэтому не хранятся в самом репозитории):
   - `DEEPSEEK_API_KEY` — ключ от DeepSeek (уже есть в `backend/.env`).
   - `ANTHROPIC_API_KEY` — ключ от Anthropic, если решите его завести (см. память проекта — раньше сознательно отказались из-за цены).
   - `FRONTEND_ORIGIN` — сюда позже впишете адрес сайта с Vercel (шаг 2), например `https://ваш-проект.vercel.app`.
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` — только если делаете аккаунты компаний (шаг 3), иначе оставить пустыми.
4. Нажать Deploy. Через пару минут появится адрес вида `https://hackathon-negotiator-backend.onrender.com` — это и есть бэкенд.

## 2. Сайт на Vercel

**Важная находка:** в папке `frontend/.vercel/` уже лежит файл со связкой на существующий проект Vercel (`projectName: "frontend"`) — похоже, кто-то уже начинал это подключать раньше. Значит, скорее всего, достаточно просто зайти на [vercel.com](https://vercel.com) под тем же аккаунтом и проверить, есть ли там проект с этим именем, а не создавать новый с нуля.

1. Зайти на [vercel.com](https://vercel.com), проверить существующие проекты (см. находку выше) или Add New → Project → выбрать репозиторий.
2. Root Directory — указать `frontend` (это важно, репозиторий не только фронтенд).
3. Environment Variables:
   - `VITE_API_BASE` — адрес бэкенда с шага 1 (например `https://hackathon-negotiator-backend.onrender.com`).
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — только если делаете аккаунты компаний (шаг 3).
   - `VITE_AVATAR_MODE` — оставить пустым или `3d`, пока не появятся видео-ролики HeyGen; когда появятся — поставить `video`.
4. Deploy. Получите адрес вида `https://ваш-проект.vercel.app` — это и есть сайт для жюри.
5. Вернуться на Render (шаг 1) и вписать этот адрес в `FRONTEND_ORIGIN`.

## 3. Аккаунты компаний через Supabase (опционально)

Без этого шага всё работает как раньше — просто без входа и без истории сессий компании.

1. Зайти на [supabase.com](https://supabase.com), создать новый проект (бесплатный tier достаточно).
2. В Supabase Dashboard → SQL Editor → вставить содержимое файла `backend/supabase/migrations/0001_init.sql` целиком → Run. Это создаст таблицы для компаний, сотрудников и истории сессий.
3. В Supabase Dashboard → Project Settings → API найти три значения и вписать их в Render/Vercel (шаги 1-2):
   - `Project URL` → это `SUPABASE_URL` (Render) и `VITE_SUPABASE_URL` (Vercel).
   - `anon public` ключ → это `VITE_SUPABASE_ANON_KEY` (Vercel).
   - `service_role` ключ (секретный, не путать с anon!) → это `SUPABASE_SERVICE_ROLE_KEY` (Render).
4. В Project Settings → API → JWT Settings найти `JWT Secret` → это `SUPABASE_JWT_SECRET` (Render).
5. После того как все четыре значения вписаны и оба сервиса передеплоены — на сайте появится экран входа с кнопкой «Зарегистрироваться» (для компании) и «Пропустить и пройти как гость» (демо-режим без изменений).

## 4. Видео-лицо аватара через HeyGen (опционально)

1. Записать в HeyGen 8 коротких роликов одним и тем же лицом (см. `PROMPTS.md`/переписку проекта для точного списка эмоций: нейтральный фон + радость/гнев/страх/удивление/отвращение/печаль/презрение).
2. Скачанные файлы назвать ровно так: `idle.mp4`, `joy.mp4`, `anger.mp4`, `fear.mp4`, `surprise.mp4`, `disgust.mp4`, `sadness.mp4`, `contempt.mp4`.
3. Положить их в `frontend/public/avatar-clips/`.
4. В Vercel поставить переменную `VITE_AVATAR_MODE=video` и передеплоить.

## Локальная проверка перед деплоем

Бэкенд: `cd backend && ../.venv/bin/python3.11 -m uvicorn server:app --reload` (если venv снова сломан — см. память проекта про битые shebang-пути, обходной путь тот же).
Фронтенд: `cd frontend && npm install && npm run dev`.
