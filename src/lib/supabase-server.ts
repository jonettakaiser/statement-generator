import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

// Session-aware client for route handlers — respects the calling user's
// cookies so `auth.getUser()` and RLS-scoped reads work as that user.
export function createSupabaseRouteClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {
          // No-op: route handlers in this app don't need to refresh the
          // session cookie themselves — the browser client owns that.
        },
        remove() {},
      },
    }
  )
}

// Service-role client for privileged server-side writes (statement
// generation, row-assignment saves, sending). Never expose to the client.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function requireAdmin() {
  const routeClient = createSupabaseRouteClient()
  const {
    data: { user },
  } = await routeClient.auth.getUser()
  if (!user) return { user: null, error: "Not authenticated" as const }

  const admin = createSupabaseAdminClient()
  const { data: userRecord } = await admin
    .from("users")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  if (userRecord?.role !== "admin") {
    return { user: null, error: "Admin access required" as const }
  }
  return { user, error: null }
}
