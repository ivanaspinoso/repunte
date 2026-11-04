import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Cliente Supabase con la sesión del usuario (respeta RLS).
 * Crear uno nuevo por request. Con Cache Components, quien lo use
 * tiene que estar dentro de un <Suspense> o en un Route Handler / Server Action.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Desde un Server Component no se pueden escribir cookies.
          // No pasa nada: el proxy (src/proxy.ts) refresca la sesión en cada request.
        }
      },
    },
  });
}
