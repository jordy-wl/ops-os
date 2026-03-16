/**
 * Document Storage Service — P3-S6-BE-02
 *
 * Stores generated documents (HTML + optional PDF) in the `documents` table
 * with auto-incrementing versions per block. PDF files go to Supabase Storage.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

/* ---------- Types ---------- */

export interface StoreDocumentInput {
  orgId: string
  blockId: string
  title: string
  format: 'html' | 'pdf' | 'markdown'
  htmlContent?: string
  pdfBuffer?: Buffer
  templateId?: string
  aiGenerated: boolean
  generationMetadata?: Record<string, unknown>
  createdBy: string
}

export interface DocumentRecord {
  id: string
  org_id: string
  block_id: string
  title: string
  version: number
  format: string
  html_content: string | null
  file_path: string | null
  file_size: number | null
  mime_type: string | null
  template_id: string | null
  ai_generated: boolean
  generation_metadata: Record<string, unknown>
  created_by: string
  created_at: string
}

export interface DocumentListItem {
  id: string
  title: string
  version: number
  format: string
  ai_generated: boolean
  template_id: string | null
  file_size: number | null
  created_by: string
  created_at: string
}

/* ---------- Store ---------- */

/**
 * Store a generated document with versioning.
 * HTML content is stored inline. PDF files are uploaded to Supabase Storage.
 */
export async function storeDocument(
  supabase: SupabaseClient,
  input: StoreDocumentInput
): Promise<DocumentRecord> {
  let filePath: string | null = null
  let fileSize: number | null = null
  let mimeType: string | null = null

  // Upload PDF to Storage if provided
  if (input.pdfBuffer) {
    const storagePath = `${input.orgId}/${input.blockId}/${crypto.randomUUID()}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, input.pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      logger.error('document-storage', 'storage.upload_failed', {
        org_id: input.orgId,
        block_id: input.blockId,
        error: uploadError.message,
      })
      throw new Error(`Failed to upload PDF: ${uploadError.message}`)
    }

    filePath = storagePath
    fileSize = input.pdfBuffer.length
    mimeType = 'application/pdf'
  }

  // If HTML-only, track size from content
  if (!filePath && input.htmlContent) {
    fileSize = Buffer.byteLength(input.htmlContent, 'utf-8')
    mimeType = 'text/html'
  }

  // Insert document record (version auto-incremented by trigger)
  const { data, error } = await supabase
    .from('documents')
    .insert({
      org_id: input.orgId,
      block_id: input.blockId,
      title: input.title,
      format: input.format,
      html_content: input.htmlContent ?? null,
      file_path: filePath,
      file_size: fileSize,
      mime_type: mimeType,
      template_id: input.templateId ?? null,
      ai_generated: input.aiGenerated,
      generation_metadata: input.generationMetadata ?? {},
      created_by: input.createdBy,
    })
    .select('*')
    .single()

  if (error || !data) {
    logger.error('document-storage', 'db.insert_failed', {
      org_id: input.orgId,
      block_id: input.blockId,
      error_code: error?.code,
    })
    throw new Error(`Failed to store document: ${error?.message ?? 'unknown error'}`)
  }

  logger.info('document-storage', 'document.stored', {
    org_id: input.orgId,
    block_id: input.blockId,
    document_id: data.id,
    version: data.version,
    format: input.format,
    ai_generated: input.aiGenerated,
  })

  return data as DocumentRecord
}

/* ---------- List ---------- */

/**
 * List documents for a block, ordered by version descending.
 */
export async function listDocuments(
  supabase: SupabaseClient,
  orgId: string,
  blockId: string,
  limit = 50
): Promise<DocumentListItem[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, version, format, ai_generated, template_id, file_size, created_by, created_at')
    .eq('org_id', orgId)
    .eq('block_id', blockId)
    .order('version', { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('document-storage', 'db.list_failed', {
      org_id: orgId,
      block_id: blockId,
      error_code: error.code,
    })
    throw new Error(`Failed to list documents: ${error.message}`)
  }

  return (data ?? []) as DocumentListItem[]
}

/* ---------- Get by ID ---------- */

/**
 * Get a specific document by ID with full content.
 */
export async function getDocument(
  supabase: SupabaseClient,
  orgId: string,
  documentId: string
): Promise<DocumentRecord | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', documentId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    logger.error('document-storage', 'db.get_failed', {
      org_id: orgId,
      document_id: documentId,
      error_code: error.code,
    })
    throw new Error(`Failed to get document: ${error.message}`)
  }

  return data as DocumentRecord
}

/* ---------- Get download URL ---------- */

/**
 * Get a signed download URL for a document's stored file.
 */
export async function getDocumentDownloadUrl(
  supabase: SupabaseClient,
  filePath: string,
  expiresIn = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, expiresIn)

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create download URL: ${error?.message ?? 'unknown error'}`)
  }

  return data.signedUrl
}

/* ---------- Version history ---------- */

/**
 * Get all versions of a document by block_id and title.
 */
export async function getDocumentVersions(
  supabase: SupabaseClient,
  orgId: string,
  blockId: string,
  title: string
): Promise<DocumentListItem[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, version, format, ai_generated, template_id, file_size, created_by, created_at')
    .eq('org_id', orgId)
    .eq('block_id', blockId)
    .eq('title', title)
    .order('version', { ascending: false })

  if (error) {
    logger.error('document-storage', 'db.versions_failed', {
      org_id: orgId,
      block_id: blockId,
      error_code: error.code,
    })
    throw new Error(`Failed to get document versions: ${error.message}`)
  }

  return (data ?? []) as DocumentListItem[]
}
