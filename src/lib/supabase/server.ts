import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

/** Client mit der Sitzung des angemeldeten Nutzers – RLS gilt. */
export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // In Server Components nicht erlaubt; der Proxy erneuert die Sitzung
        }
      },
    },
  });
}

/**
 * Client mit Service-Schlüssel – umgeht RLS. Nur serverseitig und nur zum Versand von Push-Nachrichten
 * (Geräte der anderen Haushaltsmitglieder lesen). Gibt null zurück, wenn der Schlüssel fehlt.
 */
export function supabaseAdmin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
