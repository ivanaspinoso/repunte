import Link from "next/link";
import { Marca } from "@/components/marca";

// Landing provisoria: se reemplaza por la landing real de Repunte.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-8 px-4 py-16 sm:mx-auto sm:max-w-2xl sm:px-6">
      <Marca className="text-lg" />
      <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-6xl">
        [TITULAR_LANDING]
      </h1>
      <Link
        href="/login"
        className="inline-flex h-12 items-center rounded-xl bg-tinta px-6 text-[15px] font-semibold text-crema transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-acento-fuerte"
      >
        Empezar prueba gratis
      </Link>
    </main>
  );
}
