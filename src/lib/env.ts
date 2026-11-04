// Lectura centralizada de variables de entorno.
// Falla rápido y con un mensaje claro si falta alguna.

function requerida(nombre: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisá .env.local (ver .env.example).`);
  }
  return valor;
}

// Públicas: Next las incrusta en el bundle, por eso se leen con el nombre literal.
export const SUPABASE_URL = requerida(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);
export const SUPABASE_PUBLISHABLE_KEY = requerida(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

// Slug del producto en la tabla `productos`. Cambia por producto al replicar el núcleo.
export const PRODUCTO_SLUG = process.env.NEXT_PUBLIC_PRODUCTO_SLUG ?? "repunte";
