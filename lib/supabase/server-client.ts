import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;

export function hasSupabaseServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasSupabaseServiceEnv()) {
    console.warn("Supabase service env vars missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    throw new Error("Supabase service credentials missing");
  }

  if (!serviceClient) {
    serviceClient = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        persistSession: false,
      },
    });
  }

  return serviceClient;
}
