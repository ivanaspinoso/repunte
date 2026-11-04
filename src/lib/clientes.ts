import "server-only";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTO_SLUG } from "@/lib/env";

export type Etapa = "lead" | "prueba" | "activo" | "en_riesgo" | "cancelado";

/**
 * Da de alta al usuario como cliente del producto actual.
 * Llama a la función SQL `registrar_cliente`, que en UNA transacción crea el
 * cliente en etapa 'prueba' y su evento 'signup'. Si ya existía, no duplica nada.
 */
export async function registrarCliente(userId: string, proveedor: "google" | "email") {
  const { data, error } = await createAdminClient()
    .rpc("registrar_cliente", {
      p_user_id: userId,
      p_producto_slug: PRODUCTO_SLUG,
      p_payload: { proveedor },
    })
    .single<{ cliente_id: string; etapa: Etapa; es_nuevo: boolean }>();

  if (error || !data) {
    throw new Error(`registrar_cliente falló: ${error?.message ?? "sin datos"}`);
  }
  return data;
}

export type ClienteActual = {
  email: string;
  nombre: string;
  etapa: Etapa;
  creadoEl: string;
  diasPruebaRestantes: number;
};

const DIAS_PRUEBA = Number(process.env.NEXT_PUBLIC_DIAS_PRUEBA ?? 14); // [DIAS_PRUEBA]
const DIA_MS = 86_400_000;

/**
 * Data Access Layer: usuario logueado + su cliente para este producto.
 * Lee con la sesión del usuario (RLS), así que nunca ve datos ajenos.
 * Redirige a /login si no hay sesión.
 */
export async function getClienteActual(): Promise<ClienteActual> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims;
  if (!user?.sub) redirect("/login");

  const { data: cliente } = await supabase
    .from("clientes")
    .select("etapa, created_at, productos!inner(slug)")
    .eq("user_id", user.sub)
    .eq("productos.slug", PRODUCTO_SLUG)
    .maybeSingle();

  // Caso borde: hay sesión pero el alta falló. Se reintenta desde el callback.
  if (!cliente) redirect("/auth/reintentar");

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  return {
    email: String(user.email ?? ""),
    nombre: meta.full_name ?? meta.name ?? String(user.email ?? "").split("@")[0],
    etapa: cliente.etapa as Etapa,
    creadoEl: cliente.created_at as string,
    diasPruebaRestantes: Math.max(
      0,
      DIAS_PRUEBA - Math.floor((Date.now() - new Date(cliente.created_at).getTime()) / DIA_MS),
    ),
  };
}
