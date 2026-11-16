import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// La URL y la publishable key son públicas por diseño (el navegador las ve igual);
// la seguridad la dan las políticas RLS y las funciones de la base.
// Las variables de entorno, si están, tienen prioridad (útil para otro proyecto o local).
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hwckowigwazcbsbmfkay.supabase.co";
const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_PQAgwHFgAKsb1DP7nDlTgQ_i0Hxocdc";

let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cliente) cliente = createBrowserClient(URL_SUPABASE, CLAVE_PUBLICA);
  return cliente;
}
