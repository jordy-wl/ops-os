import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client for client-side use.
 * Uses the anon key — subject to RLS policies.
 * Safe to expose to the browser.
 */
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}
