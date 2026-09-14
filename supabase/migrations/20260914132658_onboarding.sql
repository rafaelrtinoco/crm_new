-- Fase 1, incremento 1B: entrada. Fecha o bootstrap deixado em aberto no
-- 1A (empresas/empresa_membros não têm policy de insert de propósito —
-- ver docs/decisoes/0001-isolamento-multiempresa.md) com três funções
-- SECURITY DEFINER, e adiciona o perfil de usuário que faltava no schema.

-- ---------------------------------------------------------------------
-- perfis — 1:1 com auth.users. Nome/telefone coletados no cadastro
-- (PRD §6.1) não têm onde morar em auth.users (gerenciada pelo GoTrue).
-- ---------------------------------------------------------------------
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  telefone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_perfis_updated_at
  before update on public.perfis
  for each row execute function public.set_updated_at();

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, telefone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'telefone'
  );
  return new;
end;
$$;

revoke all on function public.criar_perfil() from public, authenticated;

create trigger trg_criar_perfil
  after insert on auth.users
  for each row execute function public.criar_perfil();

alter table public.perfis enable row level security;

-- Vê o próprio perfil sempre; vê o de quem compartilha alguma empresa
-- consigo (pra mostrar nome do responsável nas telas futuras). Não
-- precisa de SECURITY DEFINER: a subquery em empresa_membros já respeita
-- a RLS de lá, que por sua vez usa is_membro() — nenhuma recursão nova.
create policy "perfis_select_proprio_ou_colega"
  on public.perfis for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.empresa_membros m1
      join public.empresa_membros m2 on m1.empresa_id = m2.empresa_id
      where m1.usuario_id = (select auth.uid())
        and m2.usuario_id = perfis.id
        and m1.deleted_at is null
        and m2.deleted_at is null
    )
  );

create policy "perfis_update_proprio"
  on public.perfis for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- aplicar_template — copia o catálogo de nicho_templates pra dentro da
-- empresa. Não é SECURITY DEFINER: os inserts passam pelas policies
-- normais de tem_papel(empresa_id, 'gestor'). Quando chamada de dentro
-- de criar_empresa_com_onboarding (abaixo), herda o contexto elevado
-- dessa função; chamada direta por um usuário autenticado continua
-- protegida pela RLS normal de cada tabela.
-- ---------------------------------------------------------------------
create or replace function public.aplicar_template(p_empresa_id uuid, p_nicho text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_template public.nicho_templates%rowtype;
  v_funil jsonb;
  v_funil_id uuid;
  v_etapa text;
  v_ordem int;
  v_tipo jsonb;
  v_motivo text;
  v_tag text;
begin
  select * into v_template from public.nicho_templates where nicho = p_nicho;
  if not found then
    raise exception 'Template de nicho "%" não encontrado', p_nicho;
  end if;

  update public.empresas set vocabulario = v_template.vocabulario where id = p_empresa_id;

  for v_tipo in select * from jsonb_array_elements(v_template.vencimento_tipos)
  loop
    insert into public.vencimento_tipos (empresa_id, nome, recorrencia_padrao)
    values (p_empresa_id, v_tipo ->> 'nome', coalesce(v_tipo ->> 'recorrencia_padrao', 'anual'));
  end loop;

  for v_funil in select * from jsonb_array_elements(v_template.funis)
  loop
    insert into public.funis (empresa_id, nome, tipo)
    values (p_empresa_id, v_funil ->> 'nome', v_funil ->> 'tipo')
    returning id into v_funil_id;

    v_ordem := 0;
    for v_etapa in select * from jsonb_array_elements_text(v_funil -> 'etapas')
    loop
      v_ordem := v_ordem + 1;
      insert into public.etapas (empresa_id, funil_id, nome, ordem)
      values (p_empresa_id, v_funil_id, v_etapa, v_ordem);
    end loop;
  end loop;

  for v_motivo in select * from jsonb_array_elements_text(v_template.motivos_perda)
  loop
    insert into public.motivos_perda (empresa_id, nome) values (p_empresa_id, v_motivo);
  end loop;

  for v_tag in select * from jsonb_array_elements_text(v_template.tags)
  loop
    insert into public.tags (empresa_id, nome) values (p_empresa_id, v_tag);
  end loop;
end;
$$;

revoke all on function public.aplicar_template(uuid, text) from public;
grant execute on function public.aplicar_template(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- criar_empresa_com_onboarding — o bootstrap. SECURITY DEFINER porque
-- não existe (e nunca vai existir) policy de INSERT direta em empresas
-- nem no primeiro empresa_membros: não há membro ainda pra autorizar a
-- si mesmo. Só esta função pode criar empresa; ela sempre cria uma nova
-- (nunca recebe um empresa_id existente), o que por si só impede
-- qualquer uso pra se inserir numa empresa alheia.
--
-- Trial de 14 dias: PRD §7 não define a duração (`[PREENCHER]`) — é um
-- placeholder até a fase de billing decidir o valor real.
-- ---------------------------------------------------------------------
create or replace function public.criar_empresa_com_onboarding(
  p_nome text,
  p_nicho text,
  p_aceite_termos boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
begin
  if not p_aceite_termos then
    raise exception 'É preciso aceitar os Termos de Uso e a Política de Privacidade';
  end if;

  if not exists (select 1 from public.nicho_templates where nicho = p_nicho) then
    raise exception 'Nicho "%" não tem template cadastrado', p_nicho;
  end if;

  insert into public.empresas (nome, nicho, trial_termina_em, created_by)
  values (p_nome, p_nicho, current_date + 14, auth.uid())
  returning id into v_empresa_id;

  insert into public.empresa_membros (empresa_id, usuario_id, papel, created_by)
  values (v_empresa_id, auth.uid(), 'dono', auth.uid());

  perform public.aplicar_template(v_empresa_id, p_nicho);

  insert into public.audit_log (empresa_id, usuario_id, acao, entidade, entidade_id, detalhes)
  values (
    v_empresa_id,
    auth.uid(),
    'aceite_termos',
    'empresas',
    v_empresa_id,
    jsonb_build_object('versao', 'pendente')
  );

  return v_empresa_id;
end;
$$;

revoke all on function public.criar_empresa_com_onboarding(text, text, boolean) from public;
grant execute on function public.criar_empresa_com_onboarding(text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- aceitar_convite — SECURITY DEFINER porque o convidado ainda não é
-- membro da empresa (não passaria em tem_papel pra se auto-inserir).
-- ---------------------------------------------------------------------
create or replace function public.aceitar_convite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite public.convites%rowtype;
begin
  select * into v_convite
  from public.convites
  where token = p_token
    and status = 'pendente'
    and expira_em > now();

  if not found then
    raise exception 'Convite inválido, expirado ou já utilizado';
  end if;

  if lower(v_convite.email) <> lower((select auth.email())) then
    raise exception 'Este convite foi enviado para outro e-mail';
  end if;

  insert into public.empresa_membros (empresa_id, usuario_id, papel, created_by)
  values (v_convite.empresa_id, auth.uid(), v_convite.papel, auth.uid())
  on conflict (empresa_id, usuario_id) do nothing;

  update public.convites set status = 'aceito' where id = v_convite.id;

  return v_convite.empresa_id;
end;
$$;

revoke all on function public.aceitar_convite(uuid) from public;
grant execute on function public.aceitar_convite(uuid) to authenticated;
