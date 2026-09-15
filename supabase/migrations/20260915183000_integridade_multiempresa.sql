-- Redesenho do núcleo (parte 1/6): integridade entre empresas por chave
-- composta. Até aqui, `negocios.funil_id` (por exemplo) referenciava só
-- `funis(id)` — nada impedia gravar um negócio da empresa A apontando
-- pra um funil da empresa B, pra quem é membro das duas (cenário já
-- suportado). A RLS não cobre isso: ela valida se o ATOR pode escrever
-- na linha, não se as colunas de referência apontam pra dentro da mesma
-- empresa. Isso resolve com chaves estrangeiras compostas
-- `(empresa_id, <fk>) references <tabela> (empresa_id, id)` — vira
-- impossível por estrutura, sem trigger, sem custo de manutenção.
--
-- Mesma lógica para `responsavel_id`: hoje aponta só pra `auth.users`,
-- então nada impede atribuir um contato a alguém que nem é membro
-- daquela empresa. `empresa_membros` já tem `unique (empresa_id,
-- usuario_id)`, então a FK composta sai de graça.
--
-- Passo 1: as tabelas "pai" precisam de um `unique (empresa_id, id)`
-- pra servirem de alvo de FK composta (id já é PK/único sozinho; isso
-- só declara o par como alvo válido).
alter table public.contatos add constraint uq_contatos_empresa_id unique (empresa_id, id);
alter table public.negocios add constraint uq_negocios_empresa_id unique (empresa_id, id);
alter table public.funis add constraint uq_funis_empresa_id unique (empresa_id, id);
alter table public.etapas add constraint uq_etapas_empresa_id unique (empresa_id, id);
alter table public.vencimentos add constraint uq_vencimentos_empresa_id unique (empresa_id, id);
alter table public.tarefas add constraint uq_tarefas_empresa_id unique (empresa_id, id);
alter table public.tags add constraint uq_tags_empresa_id unique (empresa_id, id);
alter table public.vencimento_tipos add constraint uq_vencimento_tipos_empresa_id unique (empresa_id, id);
alter table public.motivos_perda add constraint uq_motivos_perda_empresa_id unique (empresa_id, id);

-- Passo 2: trocar as FKs simples por compostas. `on delete cascade` é
-- preservado onde já existia.
alter table public.etapas
  drop constraint etapas_funil_id_fkey,
  add constraint etapas_empresa_funil_id_fkey
    foreign key (empresa_id, funil_id) references public.funis (empresa_id, id) on delete cascade;

alter table public.negocios
  drop constraint negocios_contato_id_fkey,
  add constraint negocios_empresa_contato_id_fkey
    foreign key (empresa_id, contato_id) references public.contatos (empresa_id, id) on delete cascade,
  drop constraint negocios_funil_id_fkey,
  add constraint negocios_empresa_funil_id_fkey
    foreign key (empresa_id, funil_id) references public.funis (empresa_id, id),
  drop constraint negocios_etapa_id_fkey,
  add constraint negocios_empresa_etapa_id_fkey
    foreign key (empresa_id, etapa_id) references public.etapas (empresa_id, id),
  drop constraint negocios_motivo_perda_id_fkey,
  add constraint negocios_empresa_motivo_perda_id_fkey
    foreign key (empresa_id, motivo_perda_id) references public.motivos_perda (empresa_id, id);

alter table public.vencimentos
  drop constraint vencimentos_contato_id_fkey,
  add constraint vencimentos_empresa_contato_id_fkey
    foreign key (empresa_id, contato_id) references public.contatos (empresa_id, id) on delete cascade,
  drop constraint vencimentos_vencimento_tipo_id_fkey,
  add constraint vencimentos_empresa_vencimento_tipo_id_fkey
    foreign key (empresa_id, vencimento_tipo_id) references public.vencimento_tipos (empresa_id, id);

alter table public.tarefas
  drop constraint tarefas_contato_id_fkey,
  add constraint tarefas_empresa_contato_id_fkey
    foreign key (empresa_id, contato_id) references public.contatos (empresa_id, id) on delete cascade,
  drop constraint tarefas_negocio_id_fkey,
  add constraint tarefas_empresa_negocio_id_fkey
    foreign key (empresa_id, negocio_id) references public.negocios (empresa_id, id) on delete cascade;

alter table public.atividades
  drop constraint atividades_contato_id_fkey,
  add constraint atividades_empresa_contato_id_fkey
    foreign key (empresa_id, contato_id) references public.contatos (empresa_id, id) on delete cascade,
  drop constraint atividades_negocio_id_fkey,
  add constraint atividades_empresa_negocio_id_fkey
    foreign key (empresa_id, negocio_id) references public.negocios (empresa_id, id) on delete cascade;

alter table public.contato_tags
  drop constraint contato_tags_contato_id_fkey,
  add constraint contato_tags_empresa_contato_id_fkey
    foreign key (empresa_id, contato_id) references public.contatos (empresa_id, id) on delete cascade,
  drop constraint contato_tags_tag_id_fkey,
  add constraint contato_tags_empresa_tag_id_fkey
    foreign key (empresa_id, tag_id) references public.tags (empresa_id, id) on delete cascade;

alter table public.consentimentos
  drop constraint consentimentos_contato_id_fkey,
  add constraint consentimentos_empresa_contato_id_fkey
    foreign key (empresa_id, contato_id) references public.contatos (empresa_id, id) on delete cascade;

-- Passo 3: `responsavel_id` só aceita quem tem crachá daquela empresa.
-- MATCH SIMPLE (padrão do Postgres) já cobre o caso nulo: se
-- `responsavel_id` for null, a checagem nem roda — continua opcional
-- onde já era. Aponta pra `empresa_membros`, não filtra `deleted_at`:
-- se a pessoa sair da empresa, o histórico de "quem era responsável"
-- continua válido (a linha de `empresa_membros` nunca é apagada, só
-- marcada como encerrada).
alter table public.contatos
  drop constraint contatos_responsavel_id_fkey,
  add constraint contatos_empresa_responsavel_id_fkey
    foreign key (empresa_id, responsavel_id) references public.empresa_membros (empresa_id, usuario_id);

alter table public.vencimentos
  drop constraint vencimentos_responsavel_id_fkey,
  add constraint vencimentos_empresa_responsavel_id_fkey
    foreign key (empresa_id, responsavel_id) references public.empresa_membros (empresa_id, usuario_id);

alter table public.negocios
  drop constraint negocios_responsavel_id_fkey,
  add constraint negocios_empresa_responsavel_id_fkey
    foreign key (empresa_id, responsavel_id) references public.empresa_membros (empresa_id, usuario_id);

-- ---------------------------------------------------------------------
-- Passo 4: a FK composta por empresa (acima) garante que `etapa_id` é
-- uma etapa da MESMA EMPRESA, mas não que é uma etapa do MESMO FUNIL do
-- negócio — nada impedia `negocios.funil_id = X` com `etapa_id` de um
-- funil Y da mesma empresa (achado de revisão adversarial: o RPC
-- `mover_negocio_etapa` não validava isso, e nenhuma FK cobria). Fecha
-- por estrutura, não por checagem no RPC: `etapas` ganha `unique
-- (funil_id, id)` e `negocios` ganha uma SEGUNDA FK composta, por funil.
-- ---------------------------------------------------------------------
alter table public.etapas add constraint uq_etapas_funil_id unique (funil_id, id);

alter table public.negocios
  add constraint negocios_funil_etapa_fkey
    foreign key (funil_id, etapa_id) references public.etapas (funil_id, id);

alter table public.tarefas
  drop constraint tarefas_responsavel_id_fkey,
  add constraint tarefas_empresa_responsavel_id_fkey
    foreign key (empresa_id, responsavel_id) references public.empresa_membros (empresa_id, usuario_id);

alter table public.atividades
  drop constraint atividades_responsavel_id_fkey,
  add constraint atividades_empresa_responsavel_id_fkey
    foreign key (empresa_id, responsavel_id) references public.empresa_membros (empresa_id, usuario_id);
