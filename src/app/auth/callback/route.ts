import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCliente } from "@/lib/clientes";

/**
 * Google vuelve acá con ?code=...
 * 1. Canjea el code por una sesión (cookies).
 * 2. Da de alta al cliente en etapa 'prueba' + evento 'signup' (idempotente).
 * 3. Manda al dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = rutaSegura(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=sin_codigo`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] exchangeCodeForSession:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=sesion`);
  }

  try {
    await registrarCliente(data.user.id, "google");
  } catch (e) {
    // La sesión ya existe: el dashboard reintenta el alta vía /auth/reintentar.
    console.error("[auth/callback] registrarCliente:", e);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

/** Evita open-redirects: solo rutas internas. */
function rutaSegura(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}
