-- Seed local: duas empresas fictícias do nicho corretora, para testar
-- telas e isolamento entre empresas (PRD §10.6). Nenhum dado real.
-- Roda em toda `supabase db reset` (db.seed.enabled = true no config.toml).
--
-- Login de teste para todos os usuários abaixo: senha "facility123".

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Catálogo: template de nicho "corretora" (PRD §3.3).
-- ---------------------------------------------------------------------
insert into public.nicho_templates (id, nicho, nome_exibicao, vocabulario, vencimento_tipos, funis, motivos_perda, tags)
values (
  'c0000000-0000-0000-0000-000000000001',
  'corretora',
  'Corretora de seguros',
  '{"contato": "Cliente", "contatoPlural": "Clientes", "vencimento": "Apólice", "vencimentoPlural": "Apólices", "negocio": "Negócio", "negocioPlural": "Negócios"}'::jsonb,
  '[
    {"nome": "Seguro auto", "recorrencia_padrao": "anual"},
    {"nome": "Seguro residencial", "recorrencia_padrao": "anual"},
    {"nome": "Seguro vida", "recorrencia_padrao": "anual"},
    {"nome": "Seguro empresarial", "recorrencia_padrao": "anual"},
    {"nome": "Fiança locatícia", "recorrencia_padrao": "anual"},
    {"nome": "Seguro viagem", "recorrencia_padrao": "unica"},
    {"nome": "Plano de saúde", "recorrencia_padrao": "anual"},
    {"nome": "Plano odontológico", "recorrencia_padrao": "anual"},
    {"nome": "Consórcio", "recorrencia_padrao": "anual"}
  ]'::jsonb,
  '[
    {
      "nome": "Venda nova",
      "tipo": "venda_nova",
      "etapas": ["Novo lead", "Primeiro contato", "Cotação", "Proposta enviada", "Negociação", "Ganho", "Perdido"],
      "etapa_ganho": "Ganho",
      "etapa_perdida": "Perdido"
    },
    {
      "nome": "Renovação",
      "tipo": "renovacao",
      "etapas": ["A contatar", "Em contato", "Proposta de renovação", "Renovado", "Não renovado"],
      "etapa_ganho": "Renovado",
      "etapa_perdida": "Não renovado"
    }
  ]'::jsonb,
  '["Preço", "Fechou com outro", "Sem retorno", "Desistiu", "Sem perfil"]'::jsonb,
  '["VIP", "Esfriando", "Indicação"]'::jsonb
);

-- ---------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------
insert into public.empresas (id, nome, nicho, fuso, carteira_compartilhada, vocabulario)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'Seguros Alfa',
    'corretora',
    'America/Sao_Paulo',
    false,
    '{"contato": "Cliente", "contatoPlural": "Clientes", "vencimento": "Apólice", "vencimentoPlural": "Apólices", "negocio": "Negócio", "negocioPlural": "Negócios"}'::jsonb
  ),
  (
    'b0000000-0000-0000-0000-000000000001',
    'Seguros Beta',
    'corretora',
    'America/Sao_Paulo',
    true,
    '{"contato": "Segurado", "contatoPlural": "Segurados", "vencimento": "Apólice", "vencimentoPlural": "Apólices", "negocio": "Oportunidade", "negocioPlural": "Oportunidades"}'::jsonb
  );

-- ---------------------------------------------------------------------
-- Usuários (auth.users direto — só em seed local, nunca em produção).
-- ---------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'dono@segurosalfa.test', crypt('facility123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"nome":"Ana Dono"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'gestor@segurosalfa.test', crypt('facility123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"nome":"Gustavo Gestor"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'corretor@segurosalfa.test', crypt('facility123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"nome":"Carla Corretora"}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'dono@segurosbeta.test', crypt('facility123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"nome":"Beto Dono"}', false, '', '', '', '');

insert into public.empresa_membros (empresa_id, usuario_id, papel) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000101', 'dono'),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000102', 'gestor'),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000103', 'usuario'),
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000101', 'dono');

-- ---------------------------------------------------------------------
-- Funis e etapas (Venda nova + Renovação, PRD §3.3) — por empresa.
-- ---------------------------------------------------------------------
insert into public.funis (id, empresa_id, nome, tipo, ordem) values
  ('a0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000001', 'Venda nova', 'venda_nova', 1),
  ('a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000001', 'Renovação', 'renovacao', 2),
  ('b0000000-0000-0000-0000-000000000201', 'b0000000-0000-0000-0000-000000000001', 'Venda nova', 'venda_nova', 1),
  ('b0000000-0000-0000-0000-000000000202', 'b0000000-0000-0000-0000-000000000001', 'Renovação', 'renovacao', 2);

insert into public.etapas (id, empresa_id, funil_id, nome, ordem) values
  ('a0000000-0000-0000-0000-000000000211', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000201', 'Novo lead', 1),
  ('a0000000-0000-0000-0000-000000000212', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000201', 'Primeiro contato', 2),
  ('a0000000-0000-0000-0000-000000000213', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000201', 'Cotação', 3),
  ('a0000000-0000-0000-0000-000000000214', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000201', 'Proposta enviada', 4),
  ('a0000000-0000-0000-0000-000000000215', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000201', 'Negociação', 5),
  ('b0000000-0000-0000-0000-000000000211', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000201', 'Novo lead', 1),
  ('b0000000-0000-0000-0000-000000000212', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000201', 'Primeiro contato', 2),
  ('b0000000-0000-0000-0000-000000000213', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000201', 'Cotação', 3);

insert into public.motivos_perda (id, empresa_id, nome) values
  ('a0000000-0000-0000-0000-000000000221', 'a0000000-0000-0000-0000-000000000001', 'Preço'),
  ('a0000000-0000-0000-0000-000000000222', 'a0000000-0000-0000-0000-000000000001', 'Fechou com outro'),
  ('b0000000-0000-0000-0000-000000000221', 'b0000000-0000-0000-0000-000000000001', 'Sem retorno');

insert into public.vencimento_tipos (id, empresa_id, nome, recorrencia_padrao) values
  ('a0000000-0000-0000-0000-000000000231', 'a0000000-0000-0000-0000-000000000001', 'Seguro auto', 'anual'),
  ('a0000000-0000-0000-0000-000000000232', 'a0000000-0000-0000-0000-000000000001', 'Seguro vida', 'anual'),
  ('a0000000-0000-0000-0000-000000000233', 'a0000000-0000-0000-0000-000000000001', 'Plano de saúde', 'anual'),
  ('b0000000-0000-0000-0000-000000000231', 'b0000000-0000-0000-0000-000000000001', 'Seguro auto', 'anual'),
  ('b0000000-0000-0000-0000-000000000232', 'b0000000-0000-0000-0000-000000000001', 'Seguro residencial', 'anual');

insert into public.tags (id, empresa_id, nome, cor) values
  ('a0000000-0000-0000-0000-000000000241', 'a0000000-0000-0000-0000-000000000001', 'VIP', '#f59e0b'),
  ('a0000000-0000-0000-0000-000000000242', 'a0000000-0000-0000-0000-000000000001', 'Esfriando', '#64748b'),
  ('b0000000-0000-0000-0000-000000000241', 'b0000000-0000-0000-0000-000000000001', 'Indicação', '#22c55e');

-- ---------------------------------------------------------------------
-- Contatos
-- ---------------------------------------------------------------------
insert into public.contatos (id, empresa_id, nome, status, temperatura, origem, telefone, email, cpf_cnpj, responsavel_id, ultimo_contato_em) values
  ('a0000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000001', 'João Pereira', 'cliente', 'morno', 'indicacao', '(11) 98888-0001', 'joao.pereira@exemplo.test', '529.982.247-25', 'a0000000-0000-0000-0000-000000000103', now() - interval '2 days'),
  ('a0000000-0000-0000-0000-000000000302', 'a0000000-0000-0000-0000-000000000001', 'Marina Souza', 'lead', 'quente', 'facebook_ads', '(11) 98888-0002', 'marina.souza@exemplo.test', null, 'a0000000-0000-0000-0000-000000000103', now() - interval '1 hour'),
  ('a0000000-0000-0000-0000-000000000303', 'a0000000-0000-0000-0000-000000000001', 'Ricardo Lima', 'cliente', 'frio', 'site', '(11) 98888-0003', 'ricardo.lima@exemplo.test', null, 'a0000000-0000-0000-0000-000000000102', now() - interval '40 days'),
  ('a0000000-0000-0000-0000-000000000304', 'a0000000-0000-0000-0000-000000000001', 'Fernanda Alves', 'lead', 'morno', 'indicacao', '(11) 98888-0004', 'fernanda.alves@exemplo.test', null, 'a0000000-0000-0000-0000-000000000103', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000301', 'b0000000-0000-0000-0000-000000000001', 'Patrícia Nunes', 'cliente', 'morno', 'site', '(21) 97777-0001', 'patricia.nunes@exemplo.test', null, 'b0000000-0000-0000-0000-000000000101', now() - interval '5 days'),
  ('b0000000-0000-0000-0000-000000000302', 'b0000000-0000-0000-0000-000000000001', 'Diego Martins', 'lead', 'quente', 'google_ads', '(21) 97777-0002', 'diego.martins@exemplo.test', null, 'b0000000-0000-0000-0000-000000000101', now() - interval '6 hours');

update public.contatos set created_by = responsavel_id where created_by is null;

-- ---------------------------------------------------------------------
-- Vencimentos — espalhados no tempo (vencido, régua de 30/15/7 dias, futuro).
-- ---------------------------------------------------------------------
insert into public.vencimentos (empresa_id, contato_id, vencimento_tipo_id, descricao, data_vencimento, valor, recorrencia, status, responsavel_id) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000231', 'Seguro auto — Honda Civic', current_date + interval '7 days', 2400.00, 'anual', 'em_regua', 'a0000000-0000-0000-0000-000000000103'),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000303', 'a0000000-0000-0000-0000-000000000233', 'Plano de saúde família', current_date + interval '30 days', 890.00, 'anual', 'pendente', 'a0000000-0000-0000-0000-000000000102'),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000232', 'Seguro de vida', current_date - interval '3 days', 1200.00, 'anual', 'em_negociacao', 'a0000000-0000-0000-0000-000000000103'),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000304', 'a0000000-0000-0000-0000-000000000231', 'Seguro auto — Fiat Argo', current_date + interval '15 days', 1980.00, 'anual', 'em_regua', 'a0000000-0000-0000-0000-000000000103'),
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000301', 'b0000000-0000-0000-0000-000000000232', 'Seguro residencial', current_date + interval '10 days', 760.00, 'anual', 'em_regua', 'b0000000-0000-0000-0000-000000000101'),
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000302', 'b0000000-0000-0000-0000-000000000231', 'Seguro auto — Onix', current_date + interval '45 days', 2150.00, 'anual', 'pendente', 'b0000000-0000-0000-0000-000000000101');

-- ---------------------------------------------------------------------
-- Negócios — em etapas variadas do funil "Venda nova"; um ganho, um perdido.
-- ---------------------------------------------------------------------
insert into public.negocios (empresa_id, contato_id, funil_id, etapa_id, valor_estimado, responsavel_id, previsao_fechamento, proximo_passo_em, proximo_passo_acao, status, motivo_perda_id) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000302', 'a0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000212', 2400.00, 'a0000000-0000-0000-0000-000000000103', current_date + interval '10 days', current_date + interval '1 day', 'Ligar para apresentar cotação', 'aberto', null),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000304', 'a0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000214', 1980.00, 'a0000000-0000-0000-0000-000000000103', current_date + interval '5 days', current_date + interval '2 days', 'Follow-up da proposta enviada', 'aberto', null),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000215', 1200.00, 'a0000000-0000-0000-0000-000000000102', current_date, current_date, 'Renovação fechada — gerar vencimento', 'ganho', null),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000303', 'a0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000213', 890.00, 'a0000000-0000-0000-0000-000000000102', current_date - interval '5 days', current_date - interval '5 days', 'Sem retorno após 3 tentativas', 'perdido', 'a0000000-0000-0000-0000-000000000222'),
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000302', 'b0000000-0000-0000-0000-000000000201', 'b0000000-0000-0000-0000-000000000212', 2150.00, 'b0000000-0000-0000-0000-000000000101', current_date + interval '7 days', current_date + interval '1 day', 'Enviar cotação por WhatsApp', 'aberto', null);

-- ---------------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------------
insert into public.tarefas (empresa_id, contato_id, tipo, titulo, data_vencimento, responsavel_id) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000302', 'ligar', 'Ligar para Marina sobre cotação', current_date + interval '1 day', 'a0000000-0000-0000-0000-000000000103'),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000301', 'whatsapp', 'Confirmar renovação do seguro de vida', current_date - interval '1 day', 'a0000000-0000-0000-0000-000000000103'),
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000302', 'whatsapp', 'Enviar cotação do seguro auto', current_date + interval '1 day', 'b0000000-0000-0000-0000-000000000101');
