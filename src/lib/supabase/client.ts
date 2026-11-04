"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase para el navegador. Solo lee lo que RLS permite. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
