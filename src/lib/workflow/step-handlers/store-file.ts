import { logger } from '@/lib/logger'
import type { StepHandler } from './types'

/**
 * store_file handler — uploads content to Supabase Storage.
 *
 * Step config:
 * - file_content: string (required) — content to store (or base64 for binary)
 * - file_name: string (required) — filename
 * - file_bucket: string (default 'workflow-files')
 * - file_content_type: string (default 'text/plain')
 * - file_path_prefix: string (optional) — subdirectory in bucket
 */
const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>

  const content = stepAny.file_content as string | undefined
  const fileName = stepAny.file_name as string | undefined
  const bucket = (stepAny.file_bucket as string) ?? 'workflow-files'
  const contentType = (stepAny.file_content_type as string) ?? 'text/plain'
  const pathPrefix = (stepAny.file_path_prefix as string) ?? ''

  if (!content) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing file_content', executed_at: now }
  }

  if (!fileName) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing file_name', executed_at: now }
  }

  // Sanitize filename to prevent path traversal
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = [orgId, pathPrefix, `${Date.now()}_${safeName}`].filter(Boolean).join('/')

  try {
    // Determine if content is base64
    const isBase64 = contentType !== 'text/plain' && /^[A-Za-z0-9+/=]+$/.test(content.slice(0, 100))
    const fileBody = isBase64 ? Buffer.from(content, 'base64') : content

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBody, {
        contentType,
        upsert: false,
      })

    if (error) {
      logger.error('step-engine', 'step.store_file_failed', { error_code: error.message })
      return { step_name: step.name, step_type: step.type, status: 'failed', error: error.message, executed_at: now }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    logger.info('step-engine', 'step.store_file_completed', {
      path: filePath,
      bucket,
      content_type: contentType,
    })

    return {
      step_name: step.name,
      step_type: step.type,
      status: 'completed',
      output: {
        path: data?.path ?? filePath,
        bucket,
        content_type: contentType,
        public_url: urlData?.publicUrl ?? null,
        file_name: safeName,
      },
      executed_at: now,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'File upload failed'
    logger.error('step-engine', 'step.store_file_failed', { error: message.slice(0, 200) })
    return { step_name: step.name, step_type: step.type, status: 'failed', error: message, executed_at: now }
  }
}

export default handler
