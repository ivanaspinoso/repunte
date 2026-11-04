import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Cliente con la clave secreta: SALTEA RLS.
 * Solo para escrituras del sistema (eventos, etapas, suscripciones, webhooks).
 * `server-only` hace que el build falle si alguien lo importa desde el navegador.
 */
// TODO: generar tipos con `npx supabase gen types typescript` y pasarlos como genérico.
let admin: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (admin) return admin;

  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("Falta SUPABASE_SECRET_KEY. Revisá .env.local (ver .env.example).");
  }

  admin = createClient(SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
