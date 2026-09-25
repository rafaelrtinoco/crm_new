-- Configurações da empresa — fatia 1 (Empresa). PRD §6.15, recorte fora do
-- capability map da Fase 3 (fechado). Ver docs/configuracoes/SPEC-configuracoes-empresa.md.
--
-- Sem tabela nova: `empresas` já tem nome/fuso/horario_comercial/logo_url/
-- cor_primaria desde 20260910200245_extensoes_e_helpers.sql, mas a única
-- policy de UPDATE (`empresas_update_dono`) é `dono`-only, e nada na
-- interface jamais escreveu nelas — todas nascem uma vez em
-- aplicar_template() e ficam congeladas. Segue o mesmo caminho que
-- `definir_slug_empresa` (captura_leads.sql) já abriu: função
-- `security definer` dedicada pra gestor, em vez de afrouxar a policy
-- inteira de `empresas` (que também cobre `vocabulario`/
-- `carteira_compartilhada`, mais sensíveis — ficam de fora de propósito).

-- ---------------------------------------------------------------------
-- Validação de horário comercial — helper puro, reusado pelo trigger.
-- Uma janela é válida se for JSON null (dia fechado) ou um array de
-- exatamente 2 strings "HH:MM" com início < fim.
-- ---------------------------------------------------------------------
create or replace function public.janela_horario_valida(p_janela jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_inicio text;
  v_fim text;
begin
  if p_janela is null or jsonb_typeof(p_janela) = 'null' then
    return true;
  end if;

  if jsonb_typeof(p_janela) <> 'array' or jsonb_array_length(p_janela) <> 2 then
    return false;
  end if;

  v_inicio := p_janela ->> 0;
  v_fim := p_janela ->> 1;

  if v_inicio !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_fim !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    return false;
  end if;

  return v_inicio < v_fim;
end;
$$;

-- ---------------------------------------------------------------------
-- Trigger de validação em `empresas` — cobre os DOIS caminhos de escrita
-- (dono via UPDATE direto, gestor via atualizar_configuracoes_empresa
-- abaixo). Validar só dentro da função não bastaria: o dono continua
-- gravando direto pela policy nativa `empresas_update_dono` e escaparia
-- de qualquer checagem que ficasse só do lado da RPC.
-- ---------------------------------------------------------------------
create or replace function public.validar_empresa_antes_de_salvar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = NEW.fuso) then
    raise exception 'Fuso horário inválido: %', NEW.fuso;
  end if;

  if NEW.nome is null or btrim(NEW.nome) = '' then
    raise exception 'Nome da empresa não pode ser vazio';
  end if;

  if not (
    jsonb_typeof(NEW.horario_comercial) = 'object'
    and (
      select array_agg(chave order by chave)
      from jsonb_object_keys(NEW.horario_comercial) as chave
    ) = array['dom', 'sab', 'seg_sex']
  ) then
    raise exception 'horario_comercial deve ter exatamente as chaves seg_sex, sab e dom';
  end if;

  if not public.janela_horario_valida(NEW.horario_comercial -> 'seg_sex')
     or not public.janela_horario_valida(NEW.horario_comercial -> 'sab')
     or not public.janela_horario_valida(NEW.horario_comercial -> 'dom')
  then
    raise exception 'horario_comercial contém uma janela inválida (formato "HH:MM", início < fim, ou null pra dia fechado)';
  end if;

  if NEW.cor_primaria is not null and NEW.cor_primaria !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'cor_primaria deve ser um hex de 6 dígitos (#RRGGBB) ou nula';
  end if;

  return NEW;
end;
$$;

create trigger trg_empresas_validar
  before insert or update on public.empresas
  for each row execute function public.validar_empresa_antes_de_salvar();

-- ---------------------------------------------------------------------
-- atualizar_configuracoes_empresa — caminho de escrita pra gestor.
-- `slug` fica de fora (já tem `definir_slug_empresa`); `vocabulario` e
-- `carteira_compartilhada` ficam de fora de propósito (ver header do
-- spec) — carteira continua só por `.update()` direto do dono, pela
-- policy nativa.
-- ---------------------------------------------------------------------
create or replace function public.atualizar_configuracoes_empresa(
  p_empresa_id uuid,
  p_nome text,
  p_fuso text,
  p_horario_comercial jsonb,
  p_logo_url text,
  p_cor_primaria text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.tem_papel(p_empresa_id, 'gestor') then
    raise exception 'Sem permissão para configurar esta empresa';
  end if;

  update public.empresas
  set nome = p_nome,
      fuso = p_fuso,
      horario_comercial = p_horario_comercial,
      logo_url = p_logo_url,
      cor_primaria = p_cor_primaria
  where id = p_empresa_id;
end;
$$;

revoke all on function public.atualizar_configuracoes_empresa(uuid, text, text, jsonb, text, text) from public;
grant execute on function public.atualizar_configuracoes_empresa(uuid, text, text, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Storage — bucket `logos`, primeira vez que o projeto usa Storage.
-- Público: a página de captura (`obter_pagina_captura_publica`) é lida
-- por visitante anônimo, o <img src> precisa resolver sem sessão. Sem
-- SVG: bucket público servindo SVG é vetor de XSS quando o arquivo é
-- aberto direto pela URL.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Helper: a primeira pasta do caminho ({empresa_id}/...) precisa ser um
-- uuid válido E o usuário atual precisa ser gestor+ daquela empresa.
-- `security definer` porque `tem_papel` também é (chamada em cascata,
-- mesmo padrão do resto do projeto). Guarda de formato ANTES do cast —
-- um objeto com pasta que não é uuid deve ser negado, não estourar a
-- avaliação da policy inteira.
create or replace function public.storage_pasta_e_empresa_gestor(p_nome text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pasta text;
  v_empresa_id uuid;
begin
  v_pasta := (storage.foldername(p_nome))[1];

  if v_pasta is null or v_pasta !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;

  v_empresa_id := v_pasta::uuid;

  return public.tem_papel(v_empresa_id, 'gestor');
end;
$$;

revoke all on function public.storage_pasta_e_empresa_gestor(text) from public;
grant execute on function public.storage_pasta_e_empresa_gestor(text) to authenticated;

-- Sem policy de select: bucket público já serve leitura sem RLS via
-- `/storage/v1/object/public/...`, não precisa de policy de SELECT em
-- `storage.objects` pra isso funcionar.
create policy "logos_insert_gestor"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'logos' and public.storage_pasta_e_empresa_gestor(name));

create policy "logos_update_gestor"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'logos' and public.storage_pasta_e_empresa_gestor(name))
  with check (bucket_id = 'logos' and public.storage_pasta_e_empresa_gestor(name));

create policy "logos_delete_gestor"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'logos' and public.storage_pasta_e_empresa_gestor(name));
