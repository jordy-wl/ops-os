import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkflowStep } from '../../template-schema'
import type { InstanceMetadata } from '../types'

const META: InstanceMetadata = {
  template_id: 'tpl-1',
  source_block_id: 'block-source',
  applies_to_type: 'client',
  status: 'running',
  current_step_index: 0,
  step_results: [],
  started_at: '2026-01-01T00:00:00Z',
  completed_at: null,
}

function createMockSupabase(uploadError?: { message: string }) {
  return {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue(
          uploadError
            ? { data: null, error: uploadError }
            : { data: { path: 'org-1/reports/12345_report.csv' }, error: null }
        ),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://storage.example.com/org-1/reports/12345_report.csv' },
        }),
      }),
    },
    // Required by StepHandler type but not used by store_file
    from: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('store_file handler', () => {
  it('uploads file to storage', async () => {
    const handler = (await import('../store-file')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'save_report',
      type: 'store_file',
      file_content: 'id,name,value\n1,Deal A,50000',
      file_name: 'report.csv',
      file_content_type: 'text/csv',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output?.bucket).toBe('workflow-files')
    expect(result.output?.content_type).toBe('text/csv')
    expect(result.output?.file_name).toBe('report.csv')
  })

  it('fails when file_content is missing', async () => {
    const handler = (await import('../store-file')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'no_content',
      type: 'store_file',
      file_name: 'report.csv',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('file_content')
  })

  it('fails when file_name is missing', async () => {
    const handler = (await import('../store-file')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'no_name',
      type: 'store_file',
      file_content: 'some data',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('file_name')
  })

  it('sanitizes filename for path traversal', async () => {
    const handler = (await import('../store-file')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'bad_name',
      type: 'store_file',
      file_content: 'data',
      file_name: '../../../etc/passwd',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('completed')
    expect(result.output?.file_name).toBe('.._.._.._etc_passwd')
  })

  it('handles upload error', async () => {
    const handler = (await import('../store-file')).default
    const supabase = createMockSupabase({ message: 'Bucket not found' })

    const step = {
      name: 'upload_fail',
      type: 'store_file',
      file_content: 'data',
      file_name: 'test.txt',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('Bucket not found')
  })

  it('uses custom bucket and prefix', async () => {
    const handler = (await import('../store-file')).default
    const supabase = createMockSupabase()

    const step = {
      name: 'custom_path',
      type: 'store_file',
      file_content: '{"data": true}',
      file_name: 'output.json',
      file_bucket: 'custom-bucket',
      file_path_prefix: 'exports/daily',
      file_content_type: 'application/json',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)
    expect(result.status).toBe('completed')
    expect(result.output?.bucket).toBe('custom-bucket')
    expect(result.output?.content_type).toBe('application/json')
    expect(supabase.storage.from).toHaveBeenCalledWith('custom-bucket')
  })
})
