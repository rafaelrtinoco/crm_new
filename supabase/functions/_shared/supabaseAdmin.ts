import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Cliente `service_role` — bypassa RLS. Só pra uso dentro de Edge
 * Functions, nunca no frontend. Toda query que usa isso tem que
 * filtrar `empresa_id`/`destinatario_id` explicitamente, já que a RLS
 * não protege mais (ver `.claude/rules/Supabase.md`).
 */
export function criarClienteAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados no ambiente da function.",
    );
  }
  return createClient(url, serviceRoleKey);
}
