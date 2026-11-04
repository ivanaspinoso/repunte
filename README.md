# Repunte

Núcleo de automatización multi-producto: Next.js 16 (App Router, Cache Components) + Supabase + Vercel + Tailwind 4.

> **Ojo, Next 16:** `middleware.ts` ahora se llama `proxy.ts`, y todo lo que lee cookies o `searchParams` va detrás de `<Suspense>`. Ver `AGENTS.md`.

## Arrancar en local

```bash
npm install
cp .env.example .env.local   # completar las claves de Supabase
npm run dev                  # http://localhost:3000
```

## Estado del plan

| Paso | Qué | Estado |
|---|---|---|
| 1 | Tablas + RLS (`supabase/migrations/…0001_nucleo.sql`) | ✅ aplicada en Supabase |
| 2 | `trackEvent()` en `src/lib/eventos.ts` | ✅ |
| 3 | Login con Google + alta en etapa `prueba` | ✅ código · ⏳ migración `…0002` |
| 4–10 | Mercado Pago, cobranza, emails, onboarding, métricas, informe, /admin | pendiente |

## Cómo funciona el alta (paso 3)

1. `/login` → "Continuar con Google" → Google → `/auth/callback?code=…`
2. El callback canjea el código por una sesión y llama a `registrar_cliente()` (SQL).
3. `registrar_cliente` crea el cliente en etapa `prueba` **y** el evento `signup` en una sola transacción. Si el usuario vuelve a entrar, no duplica nada.
4. Si el alta falla por red, `/dashboard` lo detecta y reintenta vía `/auth/reintentar`.

## Reglas de seguridad

- Toda escritura del sistema (eventos, etapas, suscripciones) pasa por `createAdminClient()` (`server-only`). El navegador solo **lee** lo propio vía RLS.
- `eventos` es append-only: la base bloquea UPDATE, DELETE y TRUNCATE.
- `registrar_cliente` solo la puede ejecutar `service_role`.
- Las claves van en `.env.local` / Vercel. Nunca en el código.

## Verificar

```bash
npm run test:sql     # 30 pruebas de tablas, RLS y alta (Postgres embebido, sin Docker)
npm run typecheck
npm run lint
npm run build
```

## Placeholders para completar

`[TITULAR_LOGIN]`, `[BAJADA_LOGIN]`, `[TITULAR_LANDING]`, `[DESCRIPCION_PRODUCTO]`, `[URL_TERMINOS]`, `[URL_PRIVACIDAD]`, `[EMAIL_SOPORTE]`, `[COLOR_ACENTO]` (hoy terracota), `[TIPOGRAFIA_MARCA]` (hoy fuente del sistema), `[DIAS_PRUEBA]` (env, default 14).
