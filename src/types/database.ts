export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      atividades: {
        Row: {
          contato_id: string | null
          conteudo: Json
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          negocio_id: string | null
          organizacao_id: string | null
          responsavel_id: string | null
          tarefa_id: string | null
          tipo: string
          vencimento_id: string | null
        }
        Insert: {
          contato_id?: string | null
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          negocio_id?: string | null
          organizacao_id?: string | null
          responsavel_id?: string | null
          tarefa_id?: string | null
          tipo: string
          vencimento_id?: string | null
        }
        Update: {
          contato_id?: string | null
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          negocio_id?: string | null
          organizacao_id?: string | null
          responsavel_id?: string | null
          tarefa_id?: string | null
          tipo?: string
          vencimento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atividades_empresa_contato_id_fkey"
            columns: ["empresa_id", "contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "atividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_empresa_negocio_id_fkey"
            columns: ["empresa_id", "negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "atividades_empresa_organizacao_id_fkey"
            columns: ["empresa_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "atividades_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "empresa_membros"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
          {
            foreignKeyName: "atividades_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "membros_empresa"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
          {
            foreignKeyName: "atividades_empresa_tarefa_id_fkey"
            columns: ["empresa_id", "tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "atividades_empresa_vencimento_id_fkey"
            columns: ["empresa_id", "vencimento_id"]
            isOneToOne: false
            referencedRelation: "vencimentos"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json
          empresa_id: string | null
          entidade: string
          entidade_id: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json
          empresa_id?: string | null
          entidade: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json
          empresa_id?: string | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      campos_personalizados: {
        Row: {
          chave: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          empresa_id: string
          entidade: string
          id: string
          obrigatorio: boolean
          opcoes: Json | null
          ordem: number
          rotulo: string
          tipo: string
          updated_at: string
        }
        Insert: {
          chave: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id: string
          entidade: string
          id?: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          rotulo: string
          tipo: string
          updated_at?: string
        }
        Update: {
          chave?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string
          entidade?: string
          id?: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          rotulo?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campos_personalizados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      consentimentos: {
        Row: {
          canal: string
          concedido: boolean
          contato_id: string
          created_by: string | null
          empresa_id: string
          finalidade: string
          id: string
          origem: string | null
          registrado_em: string
        }
        Insert: {
          canal: string
          concedido: boolean
          contato_id: string
          created_by?: string | null
          empresa_id: string
          finalidade: string
          id?: string
          origem?: string | null
          registrado_em?: string
        }
        Update: {
          canal?: string
          concedido?: boolean
          contato_id?: string
          created_by?: string | null
          empresa_id?: string
          finalidade?: string
          id?: string
          origem?: string | null
          registrado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "consentimentos_empresa_contato_id_fkey"
            columns: ["empresa_id", "contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "consentimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contato_tags: {
        Row: {
          contato_id: string
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          tag_id: string
        }
        Insert: {
          contato_id: string
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          tag_id: string
        }
        Update: {
          contato_id?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contato_tags_empresa_contato_id_fkey"
            columns: ["empresa_id", "contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "contato_tags_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contato_tags_empresa_tag_id_fkey"
            columns: ["empresa_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
      contatos: {
        Row: {
          campos: Json
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          empresa_id: string
          endereco: Json | null
          id: string
          nascimento: string | null
          nome: string
          organizacao_id: string | null
          origem: string | null
          responsavel_id: string | null
          status: string
          telefone: string | null
          temperatura: string | null
          ultimo_contato_em: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          campos?: Json
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id: string
          endereco?: Json | null
          id?: string
          nascimento?: string | null
          nome: string
          organizacao_id?: string | null
          origem?: string | null
          responsavel_id?: string | null
          status?: string
          telefone?: string | null
          temperatura?: string | null
          ultimo_contato_em?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          campos?: Json
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: Json | null
          id?: string
          nascimento?: string | null
          nome?: string
          organizacao_id?: string | null
          origem?: string | null
          responsavel_id?: string | null
          status?: string
          telefone?: string | null
          temperatura?: string | null
          ultimo_contato_em?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contatos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contatos_empresa_organizacao_id_fkey"
            columns: ["empresa_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "contatos_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "empresa_membros"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
          {
            foreignKeyName: "contatos_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "membros_empresa"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
        ]
      }
      convites: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          empresa_id: string
          expira_em: string
          id: string
          papel: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email: string
          empresa_id: string
          expira_em?: string
          id?: string
          papel: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          empresa_id?: string
          expira_em?: string
          id?: string
          papel?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_membros: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          empresa_id: string
          id: string
          papel: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id: string
          id?: string
          papel: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          papel?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_membros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          carteira_compartilhada: boolean
          cor_primaria: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          fuso: string
          horario_comercial: Json
          id: string
          logo_url: string | null
          nicho: string
          nome: string
          trial_termina_em: string | null
          updated_at: string
          vocabulario: Json
        }
        Insert: {
          carteira_compartilhada?: boolean
          cor_primaria?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fuso?: string
          horario_comercial?: Json
          id?: string
          logo_url?: string | null
          nicho: string
          nome: string
          trial_termina_em?: string | null
          updated_at?: string
          vocabulario?: Json
        }
        Update: {
          carteira_compartilhada?: boolean
          cor_primaria?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fuso?: string
          horario_comercial?: Json
          id?: string
          logo_url?: string | null
          nicho?: string
          nome?: string
          trial_termina_em?: string | null
          updated_at?: string
          vocabulario?: Json
        }
        Relationships: []
      }
      etapas: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          empresa_id: string
          funil_id: string
          id: string
          nome: string
          ordem: number
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id: string
          funil_id: string
          id?: string
          nome: string
          ordem?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string
          funil_id?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etapas_empresa_funil_id_fkey"
            columns: ["empresa_id", "funil_id"]
            isOneToOne: false
            referencedRelation: "funis"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "etapas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fila_envios: {
        Row: {
          agendado_para: string
          assunto: string | null
          canal: string
          chave_idempotencia: string
          contato_id: string
          conteudo: string
          created_at: string
          created_by: string | null
          empresa_id: string
          finalidade: string
          id: string
          motivo_bloqueio: string | null
          origem_id: string
          origem_tipo: string
          processado_em: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agendado_para?: string
          assunto?: string | null
          canal: string
          chave_idempotencia: string
          contato_id: string
          conteudo: string
          created_at?: string
          created_by?: string | null
          empresa_id: string
          finalidade: string
          id?: string
          motivo_bloqueio?: string | null
          origem_id: string
          origem_tipo: string
          processado_em?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agendado_para?: string
          assunto?: string | null
          canal?: string
          chave_idempotencia?: string
          contato_id?: string
          conteudo?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          finalidade?: string
          id?: string
          motivo_bloqueio?: string | null
          origem_id?: string
          origem_tipo?: string
          processado_em?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fila_envios_empresa_contato_id_fkey"
            columns: ["empresa_id", "contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "fila_envios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      funis: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          empresa_id: string
          id: string
          nome: string
          ordem: number
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      importacao_erros: {
        Row: {
          created_at: string
          dados_originais: Json | null
          empresa_id: string
          erro: string
          id: string
          importacao_id: string
          linha: number
        }
        Insert: {
          created_at?: string
          dados_originais?: Json | null
          empresa_id: string
          erro: string
          id?: string
          importacao_id: string
          linha: number
        }
        Update: {
          created_at?: string
          dados_originais?: Json | null
          empresa_id?: string
          erro?: string
          id?: string
          importacao_id?: string
          linha?: number
        }
        Relationships: [
          {
            foreignKeyName: "importacao_erros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacao_erros_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes: {
        Row: {
          arquivo_nome: string
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          mapeamento_colunas: Json
          status: string
          total_erros: number
          total_importadas: number
          total_linhas: number
          updated_at: string
        }
        Insert: {
          arquivo_nome: string
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          mapeamento_colunas?: Json
          status?: string
          total_erros?: number
          total_importadas?: number
          total_linhas?: number
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          mapeamento_colunas?: Json
          status?: string
          total_erros?: number
          total_importadas?: number
          total_linhas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "importacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      motivos_perda: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motivos_perda_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      negocios: {
        Row: {
          contato_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          empresa_id: string
          entrou_na_etapa_em: string
          etapa_id: string
          funil_id: string
          id: string
          motivo_perda_id: string | null
          organizacao_id: string | null
          previsao_fechamento: string | null
          proximo_passo_acao: string
          proximo_passo_em: string
          reativar_em: string | null
          responsavel_id: string | null
          status: string
          titulo: string | null
          updated_at: string
          valor_estimado: number | null
          vencimento_id: string | null
        }
        Insert: {
          contato_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id: string
          entrou_na_etapa_em?: string
          etapa_id: string
          funil_id: string
          id?: string
          motivo_perda_id?: string | null
          organizacao_id?: string | null
          previsao_fechamento?: string | null
          proximo_passo_acao: string
          proximo_passo_em: string
          reativar_em?: string | null
          responsavel_id?: string | null
          status?: string
          titulo?: string | null
          updated_at?: string
          valor_estimado?: number | null
          vencimento_id?: string | null
        }
        Update: {
          contato_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string
          entrou_na_etapa_em?: string
          etapa_id?: string
          funil_id?: string
          id?: string
          motivo_perda_id?: string | null
          organizacao_id?: string | null
          previsao_fechamento?: string | null
          proximo_passo_acao?: string
          proximo_passo_em?: string
          reativar_em?: string | null
          responsavel_id?: string | null
          status?: string
          titulo?: string | null
          updated_at?: string
          valor_estimado?: number | null
          vencimento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_empresa_contato_id_fkey"
            columns: ["empresa_id", "contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "negocios_empresa_etapa_id_fkey"
            columns: ["empresa_id", "etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "negocios_empresa_funil_id_fkey"
            columns: ["empresa_id", "funil_id"]
            isOneToOne: false
            referencedRelation: "funis"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "negocios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_empresa_motivo_perda_id_fkey"
            columns: ["empresa_id", "motivo_perda_id"]
            isOneToOne: false
            referencedRelation: "motivos_perda"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "negocios_empresa_organizacao_id_fkey"
            columns: ["empresa_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "negocios_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "empresa_membros"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
          {
            foreignKeyName: "negocios_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "membros_empresa"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
          {
            foreignKeyName: "negocios_empresa_vencimento_id_fkey"
            columns: ["empresa_id", "vencimento_id"]
            isOneToOne: false
            referencedRelation: "vencimentos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "negocios_funil_etapa_fkey"
            columns: ["funil_id", "etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["funil_id", "id"]
          },
        ]
      }
      nicho_templates: {
        Row: {
          cadencias: Json
          campos_personalizados: Json
          created_at: string
          funis: Json
          id: string
          motivos_perda: Json
          nicho: string
          nome_exibicao: string
          tags: Json
          updated_at: string
          vencimento_tipos: Json
          vocabulario: Json
        }
        Insert: {
          cadencias?: Json
          campos_personalizados?: Json
          created_at?: string
          funis?: Json
          id?: string
          motivos_perda?: Json
          nicho: string
          nome_exibicao: string
          tags?: Json
          updated_at?: string
          vencimento_tipos?: Json
          vocabulario?: Json
        }
        Update: {
          cadencias?: Json
          campos_personalizados?: Json
          created_at?: string
          funis?: Json
          id?: string
          motivos_perda?: Json
          nicho?: string
          nome_exibicao?: string
          tags?: Json
          updated_at?: string
          vencimento_tipos?: Json
          vocabulario?: Json
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          corpo: string
          created_at: string
          destinatario_id: string
          empresa_id: string
          enviada_push_em: string | null
          id: string
          lida_em: string | null
          tipo: string
          titulo: string
          url: string | null
        }
        Insert: {
          corpo: string
          created_at?: string
          destinatario_id: string
          empresa_id: string
          enviada_push_em?: string | null
          id?: string
          lida_em?: string | null
          tipo: string
          titulo: string
          url?: string | null
        }
        Update: {
          corpo?: string
          created_at?: string
          destinatario_id?: string
          empresa_id?: string
          enviada_push_em?: string | null
          id?: string
          lida_em?: string | null
          tipo?: string
          titulo?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacoes: {
        Row: {
          campos: Json
          cnpj: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          empresa_id: string
          endereco: Json | null
          id: string
          nome: string
          responsavel_id: string | null
          site: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          campos?: Json
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id: string
          endereco?: Json | null
          id?: string
          nome: string
          responsavel_id?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          campos?: Json
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string
          endereco?: Json | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizacoes_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "empresa_membros"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
          {
            foreignKeyName: "organizacoes_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "membros_empresa"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
        ]
      }
      perfis: {
        Row: {
          created_at: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plataforma_admins: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          usuario_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          usuario_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          usuario_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          cor: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          concluida_em: string | null
          contato_id: string | null
          created_at: string
          created_by: string | null
          data_vencimento: string
          deleted_at: string | null
          empresa_id: string
          id: string
          negocio_id: string | null
          responsavel_id: string | null
          tipo: string
          titulo: string
          updated_at: string
          vencimento_id: string | null
        }
        Insert: {
          concluida_em?: string | null
          contato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_vencimento: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          negocio_id?: string | null
          responsavel_id?: string | null
          tipo: string
          titulo: string
          updated_at?: string
          vencimento_id?: string | null
        }
        Update: {
          concluida_em?: string | null
          contato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_vencimento?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          negocio_id?: string | null
          responsavel_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          vencimento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_empresa_contato_id_fkey"
            columns: ["empresa_id", "contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "tarefas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_empresa_negocio_id_fkey"
            columns: ["empresa_id", "negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "tarefas_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "empresa_membros"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
          {
            foreignKeyName: "tarefas_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "membros_empresa"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
          {
            foreignKeyName: "tarefas_empresa_vencimento_id_fkey"
            columns: ["empresa_id", "vencimento_id"]
            isOneToOne: false
            referencedRelation: "vencimentos"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
      vencimento_tipos: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          empresa_id: string
          id: string
          nome: string
          recorrencia_padrao: string
          regua_sugerida: Json
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          recorrencia_padrao?: string
          regua_sugerida?: Json
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          recorrencia_padrao?: string
          regua_sugerida?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vencimento_tipos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vencimentos: {
        Row: {
          campos: Json
          contato_id: string
          created_at: string
          created_by: string | null
          data_vencimento: string
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          recorrencia: string
          responsavel_id: string | null
          status: string
          updated_at: string
          valor: number | null
          vencimento_anterior_id: string | null
          vencimento_tipo_id: string | null
        }
        Insert: {
          campos?: Json
          contato_id: string
          created_at?: string
          created_by?: string | null
          data_vencimento: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          recorrencia?: string
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          valor?: number | null
          vencimento_anterior_id?: string | null
          vencimento_tipo_id?: string | null
        }
        Update: {
          campos?: Json
          contato_id?: string
          created_at?: string
          created_by?: string | null
          data_vencimento?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          recorrencia?: string
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          valor?: number | null
          vencimento_anterior_id?: string | null
          vencimento_tipo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vencimentos_empresa_anterior_id_fkey"
            columns: ["empresa_id", "vencimento_anterior_id"]
            isOneToOne: false
            referencedRelation: "vencimentos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "vencimentos_empresa_contato_id_fkey"
            columns: ["empresa_id", "contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "vencimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vencimentos_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "empresa_membros"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
          {
            foreignKeyName: "vencimentos_empresa_responsavel_id_fkey"
            columns: ["empresa_id", "responsavel_id"]
            isOneToOne: false
            referencedRelation: "membros_empresa"
            referencedColumns: ["empresa_id", "usuario_id"]
          },
          {
            foreignKeyName: "vencimentos_empresa_vencimento_tipo_id_fkey"
            columns: ["empresa_id", "vencimento_tipo_id"]
            isOneToOne: false
            referencedRelation: "vencimento_tipos"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
    }
    Views: {
      membros_empresa: {
        Row: {
          empresa_id: string | null
          nome: string | null
          papel: string | null
          telefone: string | null
          usuario_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_membros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aceitar_convite: { Args: { p_token: string }; Returns: string }
      aplicar_template: {
        Args: { p_empresa_id: string; p_nicho: string }
        Returns: undefined
      }
      buscar_possiveis_duplicatas: {
        Args: {
          p_cpf_cnpj?: string
          p_email?: string
          p_empresa_id: string
          p_telefone?: string
        }
        Returns: {
          cpf_cnpj: string
          email: string
          id: string
          motivo: string
          nome: string
          telefone: string
        }[]
      }
      carteira_compartilhada: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      criar_empresa_com_onboarding: {
        Args: { p_aceite_termos: boolean; p_nicho: string; p_nome: string }
        Returns: string
      }
      dentro_horario_comercial: {
        Args: { p_empresa_id: string; p_momento: string }
        Returns: boolean
      }
      enfileirar_envio: {
        Args: {
          p_agendado_para?: string
          p_assunto?: string
          p_canal: string
          p_chave_idempotencia: string
          p_contato_id: string
          p_conteudo: string
          p_finalidade: string
          p_origem_id: string
          p_origem_tipo: string
        }
        Returns: string
      }
      excluir_registro: {
        Args: { p_id: string; p_tabela: string }
        Returns: undefined
      }
      gerar_notificacoes_diarias: {
        Args: { p_agora?: string }
        Returns: undefined
      }
      is_membro: { Args: { p_empresa_id: string }; Returns: boolean }
      marcar_negocio_ganho: {
        Args: { p_negocio_id: string }
        Returns: undefined
      }
      marcar_negocio_perdido: {
        Args: {
          p_motivo_perda_id: string
          p_negocio_id: string
          p_reativar_em?: string
        }
        Returns: undefined
      }
      mock_enviar_mensagem: {
        Args: { p_canal: string; p_conteudo: string }
        Returns: boolean
      }
      mover_negocio_etapa: {
        Args: {
          p_etapa_id: string
          p_negocio_id: string
          p_proximo_passo_acao: string
          p_proximo_passo_em: string
        }
        Returns: undefined
      }
      pode_acessar_responsavel: {
        Args: { p_empresa_id: string; p_responsavel_id: string }
        Returns: boolean
      }
      processar_fila_envios: {
        Args: { p_agora?: string; p_limite?: number }
        Returns: {
          bloqueadas: number
          enviadas: number
          reagendadas: number
        }[]
      }
      proximo_horario_comercial: {
        Args: { p_empresa_id: string; p_momento: string }
        Returns: string
      }
      renovar_vencimento: {
        Args: {
          p_nova_data: string
          p_novo_valor?: number
          p_novos_campos?: Json
          p_vencimento_id: string
        }
        Returns: string
      }
      restaurar_registro: {
        Args: { p_id: string; p_tabela: string }
        Returns: undefined
      }
      tem_papel: {
        Args: { p_empresa_id: string; p_papel: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

