import type { Metadata } from "next";
import { Suspense } from "react";
import { Marca } from "@/components/marca";
import { BotonGoogle } from "./boton-google";

export const metadata: Metadata = { title: "Entrar" };

const ERRORES: Record<string, string> = {
  sin_codigo: "Google no devolvió el código de acceso. Probá de nuevo.",
  sesion: "No pudimos iniciar tu sesión. Probá de nuevo.",
  alta: "Entraste, pero no pudimos crear tu cuenta. Escribinos a [EMAIL_SOPORTE].",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm">
        <Marca className="entrada text-lg" />

        <h1 className="entrada entrada-2 mt-10 text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-5xl">
          [TITULAR_LOGIN]
        </h1>
        <p className="entrada entrada-2 mt-4 text-base leading-relaxed text-tinta-suave">
          [BAJADA_LOGIN — ej: “Probalo [DIAS_PRUEBA] días gratis. Sin tarjeta.”]
        </p>

        <div className="entrada entrada-3 mt-10">
          {/* searchParams es dato de request: va detrás de Suspense (Cache Components) */}
          <Suspense fallback={<BotonGoogle next="/dashboard" />}>
            <LoginConParams searchParams={searchParams} />
          </Suspense>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-tinta-suave">
          Al continuar aceptás los{" "}
          <a href="[URL_TERMINOS]" className="underline decoration-linea underline-offset-4 hover:decoration-tinta">
            términos
          </a>{" "}
          y la{" "}
          <a href="[URL_PRIVACIDAD]" className="underline decoration-linea underline-offset-4 hover:decoration-tinta">
            política de privacidad
          </a>
          .
        </p>
      </div>
    </main>
  );
}

async function LoginConParams({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/dashboard";
  const codigo = typeof params.error === "string" ? params.error : null;
  const mensaje = codigo ? (ERRORES[codigo] ?? ERRORES.sesion) : null;

  return (
    <>
      {mensaje && (
        <p role="alert" className="mb-4 rounded-xl border border-error/25 bg-error/5 px-4 py-3 text-sm text-error">
          {mensaje}
        </p>
      )}
      <BotonGoogle next={next} />
    </>
  );
}
