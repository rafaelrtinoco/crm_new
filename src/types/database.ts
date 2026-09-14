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
          responsavel_id: string | null
          tipo: string
        }
        Insert: {
          contato_id?: string | null
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          negocio_id?: string | null
          responsavel_id?: string | null
          tipo: string
        }
        Update: {
          contato_id?: string | null
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          negocio_id?: string | null
          responsavel_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
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
            foreignKeyName: "consentimentos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
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
            foreignKeyName: "contato_tags_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contato_tags_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contato_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etapas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapas_funil_id_fkey"
            columns: ["funil_id"]
            isOneToOne: false
            referencedRelation: "funis"
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
          previsao_fechamento: string | null
          proximo_passo_acao: string
          proximo_passo_em: string
          reativar_em: string | null
          responsavel_id: string | null
          status: string
          updated_at: string
          valor_estimado: number | null
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
          previsao_fechamento?: string | null
          proximo_passo_acao: string
          proximo_passo_em: string
          reativar_em?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          valor_estimado?: number | null
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
          previsao_fechamento?: string | null
          proximo_passo_acao?: string
          proximo_passo_em?: string
          reativar_em?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_funil_id_fkey"
            columns: ["funil_id"]
            isOneToOne: false
            referencedRelation: "funis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_motivo_perda_id_fkey"
            columns: ["motivo_perda_id"]
            isOneToOne: false
            referencedRelation: "motivos_perda"
            referencedColumns: ["id"]
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
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
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
          vencimento_tipo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vencimentos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vencimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vencimentos_vencimento_tipo_id_fkey"
            columns: ["vencimento_tipo_id"]
            isOneToOne: false
            referencedRelation: "vencimento_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      carteira_compartilhada: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      is_membro: { Args: { p_empresa_id: string }; Returns: boolean }
      pode_acessar_responsavel: {
        Args: { p_empresa_id: string; p_responsavel_id: string }
        Returns: boolean
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

