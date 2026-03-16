/**
 * Google Docs Push — copies a template, fills placeholders, shares with client.
 * Requires an active Google connector with Drive + Docs scopes.
 */

import { logger } from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/server'
import type { SourceBlock, BrandKit } from './renderer'

interface GoogleDocsPushInput {
  connectorId: string
  orgId: string
  /** Title for the new Google Doc */
  title: string
  /** Source block for variable interpolation */
  source: SourceBlock
  /** Brand kit for {{brand.*}} variables */
  brandKit?: BrandKit | null
  /** Optional Google Drive folder ID to place the doc in */
  folderId?: string
  /** Email addresses to share the doc with (editor access) */
  shareWith?: string[]
}

interface GoogleDocsPushResult {
  documentId: string
  webViewLink: string
  title: string
}

/**
 * Create a Google Doc from block data, fill placeholders, and optionally share.
 */
export async function pushToGoogleDocs(
  input: GoogleDocsPushInput
): Promise<GoogleDocsPushResult | { error: string }> {
  try {
    const { google } = await import('googleapis')
    const { getGoogleServices } = await import('@/lib/integrations/google-client')
    const services = await getGoogleServices(input.connectorId, input.orgId)

    if (!services) {
      return { error: 'Google connector not found or inactive' }
    }

    // Build document content from source block
    const content = buildDocContent(input.source, input.brandKit)

    // Create a new Google Doc
    const createRes = await services.drive.files.create({
      requestBody: {
        name: input.title,
        mimeType: 'application/vnd.google-apps.document',
        ...(input.folderId ? { parents: [input.folderId] } : {}),
      },
    })

    const documentId = createRes.data.id
    if (!documentId) {
      return { error: 'Failed to create Google Doc — no ID returned' }
    }

    // Insert content via Docs API batchUpdate
    const docs = google.docs({ version: 'v1', auth: services.auth })
    const requests = buildBatchUpdateRequests(content)
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests },
      })
    }

    // Share with specified emails
    if (input.shareWith?.length) {
      for (const email of input.shareWith) {
        await services.drive.permissions.create({
          fileId: documentId,
          requestBody: {
            role: 'writer',
            type: 'user',
            emailAddress: email,
          },
          sendNotificationEmail: true,
        })
      }
    }

    // Get the web view link
    const fileRes = await services.drive.files.get({
      fileId: documentId,
      fields: 'webViewLink',
    })

    const webViewLink = fileRes.data.webViewLink ?? `https://docs.google.com/document/d/${documentId}/edit`

    // Log event
    const supabase = createServerClient()
    await supabase.from('events').insert({
      org_id: input.orgId,
      block_id: input.source.id,
      type: 'document.pushed_to_google',
      actor_type: 'system',
      payload: {
        google_doc_id: documentId,
        title: input.title,
        shared_with: input.shareWith ?? [],
      },
    })

    logger.info('google-docs', 'doc.pushed', {
      org_id: input.orgId,
      google_doc_id: documentId,
      title: input.title,
    })

    return { documentId, webViewLink, title: input.title }
  } catch (err) {
    logger.error('google-docs', 'doc.push_failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return { error: err instanceof Error ? err.message : 'Failed to push to Google Docs' }
  }
}

/**
 * Build plain text content sections from source block data.
 */
function buildDocContent(source: SourceBlock, brandKit?: BrandKit | null): string {
  const lines: string[] = []

  if (brandKit?.company_name) {
    lines.push(brandKit.company_name)
    if (brandKit.tagline) lines.push(brandKit.tagline)
    lines.push('')
  }

  lines.push(source.name)
  lines.push(`Type: ${source.type}`)
  lines.push(`Status: ${source.state}`)
  lines.push(`Date: ${new Date().toLocaleDateString('en-AU')}`)
  lines.push('')

  // Add metadata fields
  if (source.metadata) {
    for (const [key, value] of Object.entries(source.metadata)) {
      if (value !== null && value !== undefined && typeof value !== 'object') {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        lines.push(`${label}: ${String(value)}`)
      }
    }
  }

  return lines.join('\n')
}

/**
 * Build Google Docs API batchUpdate requests to insert text content.
 */
function buildBatchUpdateRequests(content: string) {
  if (!content) return []

  return [
    {
      insertText: {
        location: { index: 1 },
        text: content,
      },
    },
  ]
}
