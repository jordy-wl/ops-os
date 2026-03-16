import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockFrom = vi.fn()
const mockSupabase = { from: mockFrom }

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => mockSupabase,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  createNotification,
  getNotifications,
  markRead,
  markAllRead,
} from '../service'

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockInsert(data: unknown, error: unknown = null) {
  mockFrom.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  })
}

function mockSelectList(data: unknown[], error: unknown = null) {
  const listChain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({ data, error }),
          }),
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({ data, error }),
            }),
          }),
        }),
      }),
    }),
  }
  return listChain
}

function mockCountQuery(count: number, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count, error }),
        }),
      }),
    }),
  }
}

function mockUpdate(data: unknown, error: unknown = null) {
  mockFrom.mockReturnValueOnce({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data, error }),
            }),
          }),
        }),
      }),
    }),
  })
}

function mockUpdateAll(data: unknown[], error: unknown = null) {
  mockFrom.mockReturnValueOnce({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data, error }),
          }),
        }),
      }),
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('createNotification', () => {
  it('creates a notification and returns the row', async () => {
    const row = {
      id: 'notif-1',
      org_id: 'org-1',
      user_id: 'user-1',
      type: 'delta_alert',
      title: 'Workflow health critical',
      body: 'Health is 30/100',
      block_id: 'block-1',
      read: false,
      created_at: '2026-03-12T10:00:00Z',
    }
    mockInsert(row)

    const result = await createNotification({
      orgId: 'org-1',
      userId: 'user-1',
      type: 'delta_alert',
      title: 'Workflow health critical',
      body: 'Health is 30/100',
      blockId: 'block-1',
    })

    expect(result).toEqual(row)
    expect(mockFrom).toHaveBeenCalledWith('notifications')
  })

  it('returns null on insert error', async () => {
    mockInsert(null, { code: 'PGRST500', message: 'db error' })

    const result = await createNotification({
      orgId: 'org-1',
      userId: 'user-1',
      type: 'system',
      title: 'Test',
    })

    expect(result).toBeNull()
  })

  it('defaults body and blockId to null when not provided', async () => {
    const row = {
      id: 'notif-2',
      org_id: 'org-1',
      user_id: 'user-1',
      type: 'system',
      title: 'No body or block',
      body: null,
      block_id: null,
      read: false,
      created_at: '2026-03-12T10:00:00Z',
    }
    mockInsert(row)

    const result = await createNotification({
      orgId: 'org-1',
      userId: 'user-1',
      type: 'system',
      title: 'No body or block',
    })

    expect(result).not.toBeNull()
    expect(result?.body).toBeNull()
    expect(result?.block_id).toBeNull()
  })
})

describe('getNotifications', () => {
  it('returns notifications and unread count', async () => {
    const notifications = [
      { id: 'n1', read: false, title: 'Alert 1' },
      { id: 'n2', read: true, title: 'Alert 2' },
    ]
    // First call: listing query
    const listChain = mockSelectList(notifications)
    // Second call: count query
    const countChain = mockCountQuery(1)

    mockFrom.mockReturnValueOnce(listChain).mockReturnValueOnce(countChain)

    const result = await getNotifications({
      orgId: 'org-1',
      userId: 'user-1',
    })

    expect(result.notifications).toHaveLength(2)
    expect(result.unreadCount).toBe(1)
  })

  it('returns empty result on list error', async () => {
    const errorChain = mockSelectList([], { code: 'PGRST500', message: 'error' })
    mockFrom.mockReturnValueOnce(errorChain)

    const result = await getNotifications({
      orgId: 'org-1',
      userId: 'user-1',
    })

    expect(result.notifications).toEqual([])
    expect(result.unreadCount).toBe(0)
  })

  it('clamps limit to 200 max', async () => {
    // With limit > 200, should still work (internal clamp)
    const listChain = mockSelectList([])
    const countChain = mockCountQuery(0)
    mockFrom.mockReturnValueOnce(listChain).mockReturnValueOnce(countChain)

    const result = await getNotifications({
      orgId: 'org-1',
      userId: 'user-1',
      limit: 500,
    })

    expect(result.notifications).toEqual([])
  })
})

describe('markRead', () => {
  it('marks a notification as read and returns updated row', async () => {
    const row = {
      id: 'notif-1',
      org_id: 'org-1',
      user_id: 'user-1',
      type: 'delta_alert',
      title: 'Alert',
      body: null,
      block_id: null,
      read: true,
      created_at: '2026-03-12T10:00:00Z',
    }
    mockUpdate(row)

    const result = await markRead('notif-1', 'org-1', 'user-1')

    expect(result).toEqual(row)
    expect(result?.read).toBe(true)
  })

  it('returns null when notification not found', async () => {
    mockUpdate(null, { code: 'PGRST116', message: 'not found' })

    const result = await markRead('nonexistent', 'org-1', 'user-1')

    expect(result).toBeNull()
  })

  it('returns null on other database errors', async () => {
    mockUpdate(null, { code: 'PGRST500', message: 'db error' })

    const result = await markRead('notif-1', 'org-1', 'user-1')

    expect(result).toBeNull()
  })
})

describe('markAllRead', () => {
  it('marks all unread notifications and returns count', async () => {
    mockUpdateAll([{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }])

    const count = await markAllRead('org-1', 'user-1')

    expect(count).toBe(3)
  })

  it('returns 0 when no unread notifications', async () => {
    mockUpdateAll([])

    const count = await markAllRead('org-1', 'user-1')

    expect(count).toBe(0)
  })

  it('returns 0 on database error', async () => {
    mockUpdateAll([], { code: 'PGRST500', message: 'db error' })

    const count = await markAllRead('org-1', 'user-1')

    expect(count).toBe(0)
  })
})
