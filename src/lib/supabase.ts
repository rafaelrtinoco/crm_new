import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. Copie .env.example para .env.local.",
  );
}

/**
 * Cliente Supabase do frontend. Usa a `anon key` — a RLS de cada tabela
 * é quem decide o que o usuário autenticado pode ver ou alterar.
 * Nunca importe a `service_role` aqui: ela só existe em Edge Functions.
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
