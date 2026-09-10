// GERADO — não edite à mão. Rode `npm run db:types` com o Supabase local no ar.
// Placeholder até a primeira migration ser aplicada e os tipos serem gerados de fato.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
