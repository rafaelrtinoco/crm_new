-- 1C-3: a migration original (20260910200302_importacoes.sql) deixou
-- importacao_erros sem policy de insert pra `authenticated`, presumindo
-- um worker via service_role. Decisão desta fase: o processamento roda
-- no navegador, na sessão do próprio usuário — mesmo raciocínio do
-- convite manual no 1B. Precisa da policy de insert de verdade.
create policy "importacao_erros_insert_membro"
  on public.importacao_erros for insert
  to authenticated
  with check (public.is_membro(empresa_id));
