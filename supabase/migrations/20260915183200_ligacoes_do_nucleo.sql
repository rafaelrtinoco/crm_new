-- Redesenho do núcleo (parte 3/6): ligações que o PRD já previa mas o
-- schema ainda não tinha onde guardar.

-- PRD §6.4: "todo vencimento que entra na janela configurada gera um
-- card no funil de Renovação" — faltava o link de volta do negócio pro
-- vencimento que o originou. `titulo` é groundwork pra dar identidade
-- própria ao negócio (hoje dois negócios do mesmo contato ficam
-- idênticos no kanban) — a coluna existe, mas formulário/kanban ainda
-- não a leem nem escrevem; fica pra quando a tela de negócios for
-- revista (redesenho de interface está fora do escopo desta sessão).
alter table public.negocios add column titulo text;
alter table public.negocios add column vencimento_id uuid;
alter table public.negocios
  add constraint negocios_empresa_vencimento_id_fkey
    foreign key (empresa_id, vencimento_id) references public.vencimentos (empresa_id, id);
create index idx_negocios_empresa_vencimento on public.negocios (empresa_id, vencimento_id);

-- No máximo um negócio de renovação aberto por vencimento — evita
-- duplicar o card se o gatilho rodar duas vezes. `deleted_at is null` é
-- obrigatório aqui: sem ele, excluir o negócio (via `excluir_registro`,
-- que não mexe em `status`) deixaria o índice contando uma linha morta
-- pra sempre, bloqueando qualquer negócio de renovação novo pro mesmo
-- vencimento (achado de revisão adversarial pós-implementação).
create unique index uq_negocios_vencimento_aberto
  on public.negocios (vencimento_id)
  where vencimento_id is not null and status = 'aberto' and deleted_at is null;

-- PRD §6.12 "taxa de renovação por tipo" depende de conseguir seguir a
-- cadeia de renovações; `renovar_vencimento` (20260914165753) fecha o
-- atual e abre o próximo mas não guardava o elo entre os dois.
alter table public.vencimentos add column vencimento_anterior_id uuid;
alter table public.vencimentos
  add constraint vencimentos_empresa_anterior_id_fkey
    foreign key (empresa_id, vencimento_anterior_id) references public.vencimentos (empresa_id, id);
create index idx_vencimentos_empresa_anterior on public.vencimentos (empresa_id, vencimento_anterior_id);

-- PRD §6.6: régua pode criar tarefa a partir de um vencimento (ex.:
-- "ligar 7 dias antes"). Faltava a coluna pra registrar essa origem.
alter table public.tarefas add column vencimento_id uuid;
alter table public.tarefas
  add constraint tarefas_empresa_vencimento_id_fkey
    foreign key (empresa_id, vencimento_id) references public.vencimentos (empresa_id, id) on delete cascade;
create index idx_tarefas_empresa_vencimento on public.tarefas (empresa_id, vencimento_id);

-- Timeline (PRD §6.3: "vencimentos e respostas de campanhas" já estavam
-- nos tipos aceitos por `atividades.tipo`, mas não tinha como linkar de
-- volta pro vencimento/tarefa/organização específicos).
alter table public.atividades add column vencimento_id uuid;
alter table public.atividades
  add constraint atividades_empresa_vencimento_id_fkey
    foreign key (empresa_id, vencimento_id) references public.vencimentos (empresa_id, id) on delete cascade;

alter table public.atividades add column tarefa_id uuid;
alter table public.atividades
  add constraint atividades_empresa_tarefa_id_fkey
    foreign key (empresa_id, tarefa_id) references public.tarefas (empresa_id, id) on delete cascade;

alter table public.atividades add column organizacao_id uuid;
alter table public.atividades
  add constraint atividades_empresa_organizacao_id_fkey
    foreign key (empresa_id, organizacao_id) references public.organizacoes (empresa_id, id) on delete cascade;

create index idx_atividades_empresa_vencimento on public.atividades (empresa_id, vencimento_id);
create index idx_atividades_empresa_tarefa on public.atividades (empresa_id, tarefa_id);
create index idx_atividades_empresa_organizacao on public.atividades (empresa_id, organizacao_id);

-- PRD §6.5: "Ganho: marca o contato como cliente" e a UX de arrastar o
-- card pra última coluna hoje NÃO faz isso sozinho — o kanban e o status
-- do negócio são duas verdades separadas. Marcar qual etapa É a etapa de
-- ganho/perda de cada funil resolve isso na raiz (usado pelo trigger da
-- migration seguinte).
alter table public.etapas add column tipo text not null default 'normal'
  check (tipo in ('normal', 'ganho', 'perdido'));

-- No máximo uma etapa de ganho e uma de perda por funil.
create unique index uq_etapas_funil_tipo_especial
  on public.etapas (funil_id, tipo)
  where tipo <> 'normal';
