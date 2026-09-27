-- Фикс: 0001_init.sql включил RLS на companies/company_members, но добавил только
-- SELECT-политики. Без INSERT-политики Postgres по умолчанию запрещает вставку любой
-- незервисной роли — регистрация компании во фронтенде (AuthScreen.jsx) молча падает
-- (ошибка проглатывается по паттерну fail-soft всего проекта), компания не создаётся,
-- сотрудники друг друга не видят. Применить: Supabase Dashboard -> SQL Editor -> Run.

-- Любой вошедший пользователь может создать новую компанию (самостоятельная регистрация,
-- без приглашений/модерации — соответствует текущему UX регистрации).
create policy "companies: authenticated can create"
  on companies for insert
  to authenticated
  with check (true);

-- Пользователь может добавить СЕБЯ (не кого-то другого — user_id обязан быть auth.uid())
-- в компанию, но только если у этой компании ещё нет ни одного участника. Это разрешает
-- ровно тот сценарий, который делает AuthScreen.jsx при регистрации (стать первым
-- владельцем только что созданной компании), но не позволяет само-пригласиться в чужую
-- уже населённую компанию и получить доступ к чужой истории переговоров.
create policy "company_members: join own newly created company"
  on company_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from company_members existing
      where existing.company_id = company_members.company_id
    )
  );
