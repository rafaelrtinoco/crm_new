-- Redesenho do núcleo — correção pós-revisão adversarial (achado #2):
-- `etapas.tipo` (`ganho`/`perdido`, migration `ligacoes_do_nucleo.sql`) só
-- é usado pelo trigger `sincronizar_status_por_etapa` e pelos RPCs
-- `marcar_negocio_ganho`/`marcar_negocio_perdido` — mas `aplicar_template`
-- (`20260914132658_onboarding.sql`) nunca setava essa coluna: toda etapa
-- nascia `tipo = 'normal'` (default), mesmo as etapas literalmente
-- chamadas "Ganho"/"Perdido"/"Renovado"/"Não renovado" no template. Como
-- não existe (ainda) tela de gerência de funil/etapa, nenhuma empresa
-- real jamais teria uma etapa especial — o gap do PRD §6.5 que a
-- migration anterior dizia fechar continuava aberto na prática.
--
-- Correção: cada funil do template ganha `etapa_ganho`/`etapa_perdida`
-- (nome da etapa que é especial, ou ausente se o funil não tiver uma —
-- ex.: um funil totalmente custom que o cliente criar depois). Casar por
-- nome exato é seguro aqui porque quem define o nome é o próprio template
-- (não é entrada de usuário nem cruza nicho): `aplicar_template` já é
-- estrutura de dados por nicho, não código por nicho.
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
      insert into public.etapas (empresa_id, funil_id, nome, ordem, tipo)
      values (
        p_empresa_id, v_funil_id, v_etapa, v_ordem,
        case
          when v_etapa = (v_funil ->> 'etapa_ganho') then 'ganho'
          when v_etapa = (v_funil ->> 'etapa_perdida') then 'perdido'
          else 'normal'
        end
      );
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

-- `nicho_templates` é populada só pelo `seed.sql` (migrations rodam antes
-- do seed em `supabase db reset`) — as chaves `etapa_ganho`/`etapa_perdida`
-- do template "corretora" entram lá, não aqui.
