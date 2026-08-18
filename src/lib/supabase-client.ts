import { createBrowserClient } from "@supabase/ssr"

// Falls back to a placeholder so the app can build/prerender before real
// Supabase credentials are configured — auth calls simply no-op/fail until
// NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
)
