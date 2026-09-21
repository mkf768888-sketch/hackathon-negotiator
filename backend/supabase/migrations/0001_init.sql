-- Аккаунты компаний для тренажёра переговоров: компания -> сотрудники -> история сессий.
-- Применить: Supabase Dashboard -> SQL Editor -> вставить целиком -> Run.
-- (или через Supabase CLI: supabase db push, если проект связан локально)

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists company_members (
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- Бэкенд пишет сюда сервисным ключом (SUPABASE_SERVICE_ROLE_KEY) в конце каждой
-- сессии — это обходит RLS ниже, так что отдельная INSERT-политика не нужна.
create table if not exists sessions (
  id bigint generated always as identity primary key,
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  character text not null,
  rounds integer not null default 0,
  final_batna numeric,
  context jsonb,
  score jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on sessions (user_id);

alter table companies enable row level security;
alter table company_members enable row level security;
alter table sessions enable row level security;

-- Видеть можно только свою компанию.
create policy "companies: members can view their company"
  on companies for select
  using (
    exists (
      select 1 from company_members cm
      where cm.company_id = companies.id and cm.user_id = auth.uid()
    )
  );

-- Видеть можно только состав своей же компании (список коллег).
create policy "company_members: view teammates"
  on company_members for select
  using (
    company_id in (
      select cm.company_id from company_members cm where cm.user_id = auth.uid()
    )
  );

-- Сотрудник видит свои сессии; владелец/сотрудник видит сессии всех коллег своей компании.
create policy "sessions: view own or company's sessions"
  on sessions for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from company_members mine
      join company_members theirs on theirs.company_id = mine.company_id
      where mine.user_id = auth.uid() and theirs.user_id = sessions.user_id
    )
  );
