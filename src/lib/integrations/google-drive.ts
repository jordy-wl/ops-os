import { Readable } from 'stream'
import type { drive_v3 } from 'googleapis'
import { getGoogleServices } from '@/lib/integrations/google-client'
import { logger } from '@/lib/logger'

type DriveFile = {
  id: string
  name: string
  mimeType: string
  webViewLink: string | null
  createdTime: string | null
}

/**
 * Upload a file to Google Drive.
 */
export async function uploadFile(
  connectorId: string,
  orgId: string,
  opts: {
    name: string
    mimeType: string
    content: string | Buffer
    folderId?: string
  }
): Promise<DriveFile> {
  const { drive } = await getGoogleServices(connectorId, orgId)

  const requestBody: drive_v3.Schema$File = {
    name: opts.name,
    mimeType: opts.mimeType,
  }
  if (opts.folderId) {
    requestBody.parents = [opts.folderId]
  }

  const media = {
    mimeType: opts.mimeType,
    body: Readable.from([opts.content]),
  }

  const response = await drive.files.create({
    requestBody,
    media,
    fields: 'id,name,mimeType,webViewLink,createdTime',
  })

  logger.info('google-drive', 'file.uploaded', {
    connector_id: connectorId,
    file_id: response.data.id,
    name: opts.name,
  })

  return {
    id: response.data.id ?? '',
    name: response.data.name ?? opts.name,
    mimeType: response.data.mimeType ?? opts.mimeType,
    webViewLink: response.data.webViewLink ?? null,
    createdTime: response.data.createdTime ?? null,
  }
}

/**
 * List files in Google Drive, optionally filtered by folder or query.
 */
export async function listFiles(
  connectorId: string,
  orgId: string,
  opts?: {
    folderId?: string
    query?: string
    pageSize?: number
  }
): Promise<DriveFile[]> {
  const { drive } = await getGoogleServices(connectorId, orgId)

  const qParts: string[] = ['trashed = false']
  if (opts?.folderId) {
    qParts.push(`'${opts.folderId}' in parents`)
  }
  if (opts?.query) {
    qParts.push(`name contains '${opts.query}'`)
  }

  const response = await drive.files.list({
    q: qParts.join(' and '),
    pageSize: opts?.pageSize ?? 20,
    fields: 'files(id,name,mimeType,webViewLink,createdTime)',
    orderBy: 'modifiedTime desc',
  })

  return (response.data.files ?? []).map((f) => ({
    id: f.id ?? '',
    name: f.name ?? '',
    mimeType: f.mimeType ?? '',
    webViewLink: f.webViewLink ?? null,
    createdTime: f.createdTime ?? null,
  }))
}

/**
 * Create a Google Docs document in Drive.
 */
export async function createDocument(
  connectorId: string,
  orgId: string,
  opts: {
    title: string
    content?: string
    folderId?: string
  }
): Promise<DriveFile> {
  const { drive } = await getGoogleServices(connectorId, orgId)

  const requestBody: drive_v3.Schema$File = {
    name: opts.title,
    mimeType: 'application/vnd.google-apps.document',
  }
  if (opts.folderId) {
    requestBody.parents = [opts.folderId]
  }

  const response = await drive.files.create({
    requestBody,
    fields: 'id,name,mimeType,webViewLink,createdTime',
  })

  logger.info('google-drive', 'document.created', {
    connector_id: connectorId,
    file_id: response.data.id,
    title: opts.title,
  })

  return {
    id: response.data.id ?? '',
    name: response.data.name ?? opts.title,
    mimeType: response.data.mimeType ?? 'application/vnd.google-apps.document',
    webViewLink: response.data.webViewLink ?? null,
    createdTime: response.data.createdTime ?? null,
  }
}

/**
 * Delete a file from Google Drive.
 */
export async function deleteFile(
  connectorId: string,
  orgId: string,
  fileId: string
): Promise<void> {
  const { drive } = await getGoogleServices(connectorId, orgId)
  await drive.files.delete({ fileId })

  logger.info('google-drive', 'file.deleted', {
    connector_id: connectorId,
    file_id: fileId,
  })
}
