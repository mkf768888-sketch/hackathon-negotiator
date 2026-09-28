-- Фикс: политики из 0001_init.sql запрашивают company_members ИЗНУТРИ политики самой
-- company_members (и sessions/companies тоже опираются на неё) — Postgres лезет
-- проверять RLS-политику, чтобы выполнить подзапрос, а подзапрос снова требует проверки
-- той же политики → "infinite recursion detected in policy for relation company_members".
-- Стандартный фикс Supabase: вынести "мои company_id" в SECURITY DEFINER функцию — она
-- выполняется от имени владельца функции (обычно postgres, у которого BYPASSRLS),
-- поэтому не запускает рекурсивную проверку той же RLS-политики.

create schema if not exists private;

create or replace function private.my_company_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from company_members where user_id = auth.uid()
$$;

drop policy if exists "company_members: view teammates" on company_members;
create policy "company_members: view teammates"
  on company_members for select
  to authenticated
  using (company_id in (select private.my_company_ids()));

drop policy if exists "companies: members can view their company" on companies;
create policy "companies: members can view their company"
  on companies for select
  to authenticated
  using (id in (select private.my_company_ids()));

drop policy if exists "sessions: view own or company's sessions" on sessions;
create policy "sessions: view own or company's sessions"
  on sessions for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from company_members theirs
      where theirs.company_id in (select private.my_company_ids())
        and theirs.user_id = sessions.user_id
    )
  );
