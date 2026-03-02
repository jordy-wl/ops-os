import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client for server-side use (API routes, Server Components).
 * Uses the service role key — has full database access, bypasses RLS where needed.
 * NEVER expose this to the client.
 */
export function createServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase environment variables. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    )
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
