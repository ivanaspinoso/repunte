import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Paso 2 — trackEvent
 * Único punto de entrada para registrar eventos del ciclo del cliente.
 * La tabla `eventos` es append-only (la base bloquea UPDATE/DELETE) y
 * solo el servidor puede escribirla, así que un usuario no puede fabricar un "paid".
 */

export const TIPOS_EVENTO = [
  "signup",
  "activated",
  "paid",
  "payment_failed",
  "limit_reached",
  "churned",
] as const;

export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Payload tipado por evento: el compilador avisa si falta un dato. */
export type PayloadEvento = {
  signup: { proveedor: "google" | "email" };
  activated: { via: string };
  paid: { proveedor: "mercadopago"; id_externo: string; monto: number; moneda: string };
  payment_failed: { proveedor: "mercadopago"; id_externo: string; intento: number; motivo?: string };
  limit_reached: { limite: string; valor: number };
  churned: { motivo: "cancelacion" | "suspension" | "otro"; detalle?: string };
};

export class TrackEventError extends Error {}

export async function trackEvent<T extends TipoEvento>(
  clienteId: string,
  tipo: T,
  payload: PayloadEvento[T],
): Promise<void> {
  if (!TIPOS_EVENTO.includes(tipo)) {
    throw new TrackEventError(`Tipo de evento inválido: ${tipo}`);
  }

  const { error } = await createAdminClient()
    .from("eventos")
    .insert({ cliente_id: clienteId, tipo, payload });

  if (error) {
    // No se traga el error: un evento perdido rompe métricas y automatizaciones.
    throw new TrackEventError(`No se pudo registrar "${tipo}" para ${clienteId}: ${error.message}`);
  }
}
