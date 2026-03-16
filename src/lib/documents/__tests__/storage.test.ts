import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  storeDocument,
  listDocuments,
  getDocument,
  getDocumentDownloadUrl,
  getDocumentVersions,
} from '../storage'
import type { StoreDocumentInput } from '../storage'

/* ---------- Mock Supabase factory ---------- */

function makeMockSupabase(overrides: {
  insertResult?: { data: unknown; error: unknown }
  selectResult?: { data: unknown; error: unknown }
  uploadResult?: { data: unknown; error: unknown }
  signedUrlResult?: { data: unknown; error: unknown }
} = {}) {
  const insertResult = overrides.insertResult ?? { data: { id: 'doc-1', version: 1 }, error: null }
  const selectResult = overrides.selectResult ?? { data: [], error: null }
  const uploadResult = overrides.uploadResult ?? { data: { path: 'org/block/file.pdf' }, error: null }
  const signedUrlResult = overrides.signedUrlResult ?? { data: { signedUrl: 'https://example.com/signed' }, error: null }

  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(insertResult),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(selectResult),
            }),
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue(selectResult),
            }),
            single: vi.fn().mockResolvedValue(selectResult),
          }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(selectResult),
          }),
          single: vi.fn().mockResolvedValue(selectResult),
        }),
      }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue(uploadResult),
        createSignedUrl: vi.fn().mockResolvedValue(signedUrlResult),
      }),
    },
  } as unknown as Parameters<typeof storeDocument>[0]
}

/* ---------- Tests ---------- */

describe('storeDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  const baseInput: StoreDocumentInput = {
    orgId: 'org-1',
    blockId: 'block-1',
    title: 'Test Doc',
    format: 'html',
    htmlContent: '<h1>Hello</h1>',
    aiGenerated: false,
    createdBy: 'user-1',
  }

  it('stores HTML document without PDF upload', async () => {
    const mockDoc = { id: 'doc-1', version: 1, format: 'html' }
    const supabase = makeMockSupabase({
      insertResult: { data: mockDoc, error: null },
    })

    const result = await storeDocument(supabase, baseInput)
    expect(result).toEqual(mockDoc)
    // Should NOT call storage upload for HTML-only
    expect(supabase.storage.from).not.toHaveBeenCalled()
  })

  it('uploads PDF to storage when pdfBuffer provided', async () => {
    const pdfBuffer = Buffer.from('fake-pdf')
    const mockDoc = { id: 'doc-2', version: 1, format: 'pdf' }
    const supabase = makeMockSupabase({
      insertResult: { data: mockDoc, error: null },
    })

    const result = await storeDocument(supabase, {
      ...baseInput,
      format: 'pdf',
      pdfBuffer,
    })

    expect(result).toEqual(mockDoc)
    expect(supabase.storage.from).toHaveBeenCalledWith('documents')
  })

  it('throws on storage upload failure', async () => {
    const supabase = makeMockSupabase({
      uploadResult: { data: null, error: { message: 'upload failed' } },
    })

    await expect(
      storeDocument(supabase, { ...baseInput, pdfBuffer: Buffer.from('pdf') })
    ).rejects.toThrow('Failed to upload PDF')
  })

  it('throws on database insert failure', async () => {
    const supabase = makeMockSupabase({
      insertResult: { data: null, error: { code: 'PGRST', message: 'insert failed' } },
    })

    await expect(storeDocument(supabase, baseInput)).rejects.toThrow('Failed to store document')
  })

  it('includes templateId when provided', async () => {
    const mockDoc = { id: 'doc-3', version: 1 }
    const supabase = makeMockSupabase({
      insertResult: { data: mockDoc, error: null },
    })

    await storeDocument(supabase, { ...baseInput, templateId: 'tmpl-1' })

    const fromCall = supabase.from as ReturnType<typeof vi.fn>
    expect(fromCall).toHaveBeenCalledWith('documents')
  })

  it('defaults generationMetadata to empty object', async () => {
    const mockDoc = { id: 'doc-4', version: 1 }
    const supabase = makeMockSupabase({
      insertResult: { data: mockDoc, error: null },
    })

    const result = await storeDocument(supabase, baseInput)
    expect(result).toEqual(mockDoc)
  })
})

describe('listDocuments', () => {
  it('returns documents for a block', async () => {
    const docs = [
      { id: 'doc-1', title: 'Doc', version: 2 },
      { id: 'doc-2', title: 'Doc', version: 1 },
    ]
    const supabase = makeMockSupabase({
      selectResult: { data: docs, error: null },
    })

    const result = await listDocuments(supabase, 'org-1', 'block-1')
    expect(result).toEqual(docs)
  })

  it('returns empty array when no documents', async () => {
    const supabase = makeMockSupabase({
      selectResult: { data: [], error: null },
    })

    const result = await listDocuments(supabase, 'org-1', 'block-1')
    expect(result).toEqual([])
  })

  it('throws on database error', async () => {
    const supabase = makeMockSupabase({
      selectResult: { data: null, error: { code: 'ERR', message: 'query failed' } },
    })

    await expect(listDocuments(supabase, 'org-1', 'block-1')).rejects.toThrow('Failed to list documents')
  })
})

describe('getDocument', () => {
  it('returns document when found', async () => {
    const doc = { id: 'doc-1', org_id: 'org-1', html_content: '<h1>Test</h1>' }
    const supabase = makeMockSupabase({
      selectResult: { data: doc, error: null },
    })

    const result = await getDocument(supabase, 'org-1', 'doc-1')
    expect(result).toEqual(doc)
  })

  it('returns null when not found (PGRST116)', async () => {
    const supabase = makeMockSupabase({
      selectResult: { data: null, error: { code: 'PGRST116', message: 'not found' } },
    })

    const result = await getDocument(supabase, 'org-1', 'doc-missing')
    expect(result).toBeNull()
  })

  it('throws on unexpected database error', async () => {
    const supabase = makeMockSupabase({
      selectResult: { data: null, error: { code: 'ERR', message: 'unexpected' } },
    })

    await expect(getDocument(supabase, 'org-1', 'doc-1')).rejects.toThrow('Failed to get document')
  })
})

describe('getDocumentDownloadUrl', () => {
  it('returns signed URL', async () => {
    const supabase = makeMockSupabase({
      signedUrlResult: { data: { signedUrl: 'https://example.com/signed-url' }, error: null },
    })

    const url = await getDocumentDownloadUrl(supabase, 'org/block/file.pdf')
    expect(url).toBe('https://example.com/signed-url')
  })

  it('throws when signed URL creation fails', async () => {
    const supabase = makeMockSupabase({
      signedUrlResult: { data: null, error: { message: 'denied' } },
    })

    await expect(getDocumentDownloadUrl(supabase, 'bad/path')).rejects.toThrow('Failed to create download URL')
  })
})

describe('getDocumentVersions', () => {
  it('returns versions for block + title', async () => {
    const versions = [
      { id: 'doc-2', title: 'Report', version: 2 },
      { id: 'doc-1', title: 'Report', version: 1 },
    ]
    const supabase = makeMockSupabase({
      selectResult: { data: versions, error: null },
    })

    const result = await getDocumentVersions(supabase, 'org-1', 'block-1', 'Report')
    expect(result).toEqual(versions)
  })

  it('throws on error', async () => {
    const supabase = makeMockSupabase({
      selectResult: { data: null, error: { code: 'ERR', message: 'failed' } },
    })

    await expect(
      getDocumentVersions(supabase, 'org-1', 'block-1', 'Report')
    ).rejects.toThrow('Failed to get document versions')
  })
})
