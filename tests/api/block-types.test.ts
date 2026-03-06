/**
 * tests/api/block-types.test.ts — Block Type Definitions Contract Tests
 *
 * Tests run against a REAL local Supabase instance.
 * Requires: supabase start + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Tests cover the full CRUD lifecycle, org isolation, and delete guards.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { hasSupabase, getTestSupabase, makePost, makePatch } from './helpers'

// ─── Shared test org context ────────────────────────────────────────────────
const ctx = vi.hoisted(() => ({
  orgId: '',
  orgBId: '',
  userId: 'user_bt_contract_test',
  clerkOrgId: '',
  clerkOrgBId: '',
}))

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) =>
        handler(
          req,
          { userId: ctx.userId, clerkOrgId: ctx.clerkOrgId, orgId: ctx.orgId, role: 'ops-admin' as const },
          await (context.params ?? Promise.resolve({}))
        )
  ),
}))

vi.mock('@/lib/supabase/server', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return {
    createServerClient: vi.fn(() =>
      createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      )
    ),
  }
})

describe.skipIf(!hasSupabase)('Block Types API — Contract Tests', () => {
  let createdTypeId = ''

  beforeAll(async () => {
    const supabase = getTestSupabase()

    // Create org A
    const { data: orgA } = await supabase
      .from('orgs')
      .insert({ clerk_org_id: `clerk_bt_test_a_${Date.now()}` })
      .select('id, clerk_org_id')
      .single()
    ctx.orgId = orgA!.id
    ctx.clerkOrgId = orgA!.clerk_org_id

    // Create org B for isolation tests
    const { data: orgB } = await supabase
      .from('orgs')
      .insert({ clerk_org_id: `clerk_bt_test_b_${Date.now()}` })
      .select('id, clerk_org_id')
      .single()
    ctx.orgBId = orgB!.id
    ctx.clerkOrgBId = orgB!.clerk_org_id
  })

  it('round-trip: create → list → update → delete', async () => {
    const { POST: createType, GET: listTypes } = await import('@/app/api/block-types/route')
    const { PATCH: patchType, DELETE: deleteType } = await import('@/app/api/block-types/[id]/route')

    // CREATE
    const createRes = await createType(
      makePost('http://localhost/api/block-types', {
        type_name: 'test_entity',
        display_name: 'Test Entity',
        description: 'For contract tests',
        field_schema: {
          type: 'object',
          properties: { label: { type: 'string' } },
        },
        icon: 'star',
        color: 'red',
      }),
      { params: Promise.resolve({}) }
    )
    expect(createRes.status).toBe(201)
    const createBody = await createRes.json()
    createdTypeId = createBody.data.id
    expect(createBody.data.type_name).toBe('test_entity')
    expect(createBody.data.is_system).toBe(false)

    // LIST
    const listRes = await listTypes(
      new NextRequest('http://localhost/api/block-types'),
      { params: Promise.resolve({}) }
    )
    expect(listRes.status).toBe(200)
    const listBody = await listRes.json()
    expect(listBody.data.some((t: { type_name: string }) => t.type_name === 'test_entity')).toBe(true)

    // UPDATE
    const patchRes = await patchType(
      makePatch(`http://localhost/api/block-types/${createdTypeId}`, {
        display_name: 'Updated Test Entity',
      }),
      { params: Promise.resolve({ id: createdTypeId }) }
    )
    expect(patchRes.status).toBe(200)
    const patchBody = await patchRes.json()
    expect(patchBody.data.display_name).toBe('Updated Test Entity')

    // DELETE
    const deleteRes = await deleteType(
      new NextRequest(`http://localhost/api/block-types/${createdTypeId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: createdTypeId }) }
    )
    expect(deleteRes.status).toBe(200)
    const deleteBody = await deleteRes.json()
    expect(deleteBody.data.deleted).toBe(true)
  })

  it('org isolation: org B cannot see org A types', async () => {
    const { POST: createType, GET: listTypes } = await import('@/app/api/block-types/route')

    // Create a type in org A
    const createRes = await createType(
      makePost('http://localhost/api/block-types', {
        type_name: 'org_a_only',
        display_name: 'Org A Only',
      }),
      { params: Promise.resolve({}) }
    )
    expect(createRes.status).toBe(201)

    // Switch to org B
    const savedOrgId = ctx.orgId
    ctx.orgId = ctx.orgBId

    const listRes = await listTypes(
      new NextRequest('http://localhost/api/block-types'),
      { params: Promise.resolve({}) }
    )
    const listBody = await listRes.json()
    const hasOrgAType = listBody.data.some(
      (t: { type_name: string }) => t.type_name === 'org_a_only'
    )
    expect(hasOrgAType).toBe(false)

    // Restore org A
    ctx.orgId = savedOrgId
  })

  it('delete guard: cannot delete type when blocks exist', async () => {
    const { POST: createType } = await import('@/app/api/block-types/route')
    const { DELETE: deleteType } = await import('@/app/api/block-types/[id]/route')

    // Create a type
    const createRes = await createType(
      makePost('http://localhost/api/block-types', {
        type_name: 'guarded_type',
        display_name: 'Guarded',
      }),
      { params: Promise.resolve({}) }
    )
    const typeId = (await createRes.json()).data.id

    // Create a block with that type using test Supabase directly
    const supabase = getTestSupabase()
    await supabase.from('blocks').insert({
      org_id: ctx.orgId,
      type: 'guarded_type',
      name: 'Test Block for Guard',
    })

    // Attempt to delete — should fail with 409
    const deleteRes = await deleteType(
      new NextRequest(`http://localhost/api/block-types/${typeId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: typeId }) }
    )
    expect(deleteRes.status).toBe(409)
    const body = await deleteRes.json()
    expect(body.error.code).toBe('block-types/in-use')
  })

  it('duplicate type_name returns 409', async () => {
    const { POST: createType } = await import('@/app/api/block-types/route')

    // Create first
    await createType(
      makePost('http://localhost/api/block-types', {
        type_name: 'unique_check',
        display_name: 'Unique Check',
      }),
      { params: Promise.resolve({}) }
    )

    // Create duplicate — should fail
    const dupRes = await createType(
      makePost('http://localhost/api/block-types', {
        type_name: 'unique_check',
        display_name: 'Unique Check Again',
      }),
      { params: Promise.resolve({}) }
    )
    expect(dupRes.status).toBe(409)
  })
})
