import type { Metadata } from "next";
import { Suspense } from "react";
import { Marca } from "@/components/marca";
import { getClienteActual, type Etapa } from "@/lib/clientes";

export const metadata: Metadata = { title: "Panel" };

const ETIQUETA: Record<Etapa, string> = {
  lead: "Lead",
  prueba: "Prueba gratis",
  activo: "Activo",
  en_riesgo: "Pago pendiente",
  cancelado: "Cancelado",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-linea">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Marca />
          <form action="/auth/salir" method="post">
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-sm font-medium text-tinta-suave transition-colors hover:bg-crema-2 hover:text-tinta"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        {/* La sesión se lee en request: detrás de Suspense (Cache Components) */}
        <Suspense fallback={<Esqueleto />}>
          <Contenido />
        </Suspense>
      </main>
    </div>
  );
}

async function Contenido() {
  const cliente = await getClienteActual();
  const diasRestantes = cliente.diasPruebaRestantes;

  return (
    <>
      <p className="entrada text-sm font-medium text-tinta-suave">Hola, {cliente.nombre.split(" ")[0]}</p>
      <h1 className="entrada entrada-2 mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Tu panel
      </h1>

      <section
        aria-labelledby="estado-cuenta"
        className="entrada entrada-3 mt-8 rounded-2xl border border-linea bg-white/60 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="estado-cuenta" className="text-base font-bold">
            Estado de tu cuenta
          </h2>
          <span className="inline-flex items-center gap-2 rounded-full bg-crema-2 px-3 py-1 text-sm font-semibold">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-oliva" />
            {ETIQUETA[cliente.etapa]}
          </span>
        </div>

        {cliente.etapa === "prueba" && (
          <p className="mt-3 text-sm leading-relaxed text-tinta-suave">
            Te quedan <strong className="font-bold text-tinta">{diasRestantes} días</strong> de prueba.
          </p>
        )}
        <p className="mt-1 text-sm text-tinta-suave">{cliente.email}</p>
      </section>

      {/* Paso 7: acá va el checklist de onboarding */}
    </>
  );
}

function Esqueleto() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="h-4 w-24 rounded bg-crema-2" />
      <div className="mt-3 h-9 w-48 rounded bg-crema-2" />
      <div className="mt-8 h-32 rounded-2xl bg-crema-2" />
    </div>
  );
}
