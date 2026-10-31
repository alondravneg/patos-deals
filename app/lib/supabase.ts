import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Faltan las variables de entorno de Supabase. Revisa el archivo .env.local."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}