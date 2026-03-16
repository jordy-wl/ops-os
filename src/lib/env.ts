/**
 * Environment variable validation — runs once on server startup.
 * Import this in instrumentation.ts to fail fast with clear error messages.
 */

const required: Record<string, string | undefined> = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
}

const optional: Record<string, string | undefined> = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  WORKFLOW_ENGINE_SECRET: process.env.WORKFLOW_ENGINE_SECRET,
}

const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables:\n  ${missing.join('\n  ')}\n\n` +
    'Copy .env.example to .env.local and fill in the values.\n' +
    'For Vercel: set these in Project Settings > Environment Variables.'
  )
}

const missingOptional = Object.entries(optional)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missingOptional.length > 0 && process.env.NODE_ENV === 'development') {
  console.warn(
    `[env] Optional variables not set (some features will be disabled):\n  ${missingOptional.join('\n  ')}`
  )
}

export const env = {
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
} as const
