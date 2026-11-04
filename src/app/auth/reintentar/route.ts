import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCliente } from "@/lib/clientes";

/**
 * Red de seguridad: si el alta del cliente falló en el callback (red, timeout),
 * el dashboard redirige acá y se reintenta. Como registrar_cliente es idempotente,
 * reintentar nunca duplica clientes ni eventos.
 */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) return NextResponse.redirect(`${origin}/login`);

  try {
    await registrarCliente(userId, "google");
    return NextResponse.redirect(`${origin}/dashboard`);
  } catch (e) {
    console.error("[auth/reintentar]", e);
    return NextResponse.redirect(`${origin}/login?error=alta`);
  }
}
