/**
 * tests/api/helpers.ts — Shared utilities for API contract tests.
 *
 * These tests run against a REAL local Supabase instance.
 * Prerequisites: supabase start (or equivalent) must be running.
 *
 * Tests do NOT clean up after themselves because the events immutability
 * trigger prevents cascade deletes on org rows that have events.
 * Use `npm run db:reset && npm run db:seed` to clear the local DB.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

/** Returns true when real Supabase credentials are configured. */
export const hasSupabase =
  SUPABASE_URL.startsWith('http') &&
  SUPABASE_SERVICE_ROLE_KEY.length > 20 &&
  !SUPABASE_URL.includes('YOUR_PROJECT_REF')

/**
 * Creates a service-role Supabase client for test setup and assertions.
 * Bypasses RLS — do NOT use this in application code.
 */
export function getTestSupabase() {
  if (!hasSupabase) throw new Error('Supabase is not configured for contract tests')
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

/**
 * Creates a NextRequest for testing API route handlers.
 */
export function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(url, options as ConstructorParameters<typeof NextRequest>[1])
}

/**
 * Creates a JSON POST NextRequest.
 */
export function makePost(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Creates a JSON PATCH NextRequest.
 */
export function makePatch(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Creates a DELETE NextRequest.
 */
export function makeDelete(url: string) {
  return new NextRequest(url, {
    method: 'DELETE',
  })
}
