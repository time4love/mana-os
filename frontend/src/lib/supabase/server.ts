import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Server-side Supabase client using the anon key. Use in Server Actions and RSC
 * for profiles (e.g. anchor Soul Contract). Writes run on the server, so the key
 * is not exposed to the client. No service role required.
 */
export function createServerSupabase(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
