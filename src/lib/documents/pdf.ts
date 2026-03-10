/**
 * PDF Generation — P2-S9-BE-04
 *
 * Converts rendered HTML to PDF using jsPDF for server-side generation.
 * Optionally uploads the resulting PDF to Google Drive.
 *
 * For rich HTML→PDF, the primary approach is client-side print (window.print())
 * with a server-side jsPDF fallback for text-based documents.
 */

import { jsPDF } from 'jspdf'
import { uploadFile } from '@/lib/integrations/google-drive'

/* ---------- Types ---------- */

export interface PdfOptions {
  title?: string
  margin?: number
  fontSize?: number
  lineHeight?: number
}

export interface PdfResult {
  buffer: Buffer
  driveUrl?: string
}

/* ---------- HTML to plain text ---------- */

/**
 * Strip HTML tags and decode entities to extract plain text.
 * Used for jsPDF text-based rendering.
 */
function htmlToPlainText(html: string): string {
  // Remove style and script blocks
  let text = html.replace(/<style[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '')

  // Convert block elements to newlines
  text = text.replace(/<\/?(h[1-6]|p|div|br|li|tr)[^>]*>/gi, '\n')
  text = text.replace(/<\/?(ul|ol|table|thead|tbody)[^>]*>/gi, '\n')
  text = text.replace(/<hr[^>]*>/gi, '\n---\n')

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#x27;/g, "'")
  text = text.replace(/&nbsp;/g, ' ')

  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.trim()

  return text
}

/**
 * Wrap text to fit within a max width (approximate character count per line).
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }

    const words = paragraph.split(' ')
    let currentLine = ''

    for (const word of words) {
      if (currentLine.length + word.length + 1 > maxCharsPerLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = currentLine ? `${currentLine} ${word}` : word
      }
    }

    if (currentLine) lines.push(currentLine)
  }

  return lines
}

/* ---------- PDF generation ---------- */

/**
 * Generate a PDF from rendered HTML content.
 *
 * Uses jsPDF for server-side text-based PDF generation. For complex HTML layouts,
 * the recommended approach is client-side rendering via window.print() or
 * an iframe-based print dialog.
 *
 * @param html - Rendered HTML string (from renderer.ts)
 * @param options - PDF generation options
 * @returns Buffer containing the PDF data
 */
export function generatePdf(html: string, options?: PdfOptions): Buffer {
  const margin = options?.margin ?? 20
  const fontSize = options?.fontSize ?? 11
  const lineHeight = options?.lineHeight ?? 1.4
  const title = options?.title ?? 'Document'

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  doc.setProperties({ title })

  // Extract plain text from HTML
  const plainText = htmlToPlainText(html)

  // Calculate usable width and chars per line
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const usableWidth = pageWidth - margin * 2
  const charsPerLine = Math.floor(usableWidth / (fontSize * 0.22))
  const lineHeightMm = fontSize * 0.3528 * lineHeight // pt → mm × lineHeight

  // Wrap and render text
  const lines = wrapText(plainText, charsPerLine)
  let y = margin

  doc.setFontSize(fontSize)

  for (const line of lines) {
    if (y + lineHeightMm > pageHeight - margin) {
      doc.addPage()
      y = margin
    }

    // Detect headings (lines that are all-caps or start with markdown-style markers)
    if (line.startsWith('---')) {
      doc.setDrawColor(200)
      doc.line(margin, y, pageWidth - margin, y)
      y += lineHeightMm * 0.5
      continue
    }

    doc.text(line, margin, y)
    y += lineHeightMm
  }

  // Output as Buffer
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

/**
 * Generate PDF and optionally upload to Google Drive.
 *
 * @param html - Rendered HTML string
 * @param options - PDF options
 * @param driveConfig - If provided, uploads PDF to Google Drive
 * @returns PdfResult with buffer and optional Drive URL
 */
export async function generateAndStore(
  html: string,
  options?: PdfOptions,
  driveConfig?: {
    connectorId: string
    orgId: string
    fileName: string
    folderId?: string
  }
): Promise<PdfResult> {
  const buffer = generatePdf(html, options)

  if (!driveConfig) {
    return { buffer }
  }

  // Upload to Google Drive
  const driveFile = await uploadFile(
    driveConfig.connectorId,
    driveConfig.orgId,
    {
      name: driveConfig.fileName,
      mimeType: 'application/pdf',
      content: buffer,
      folderId: driveConfig.folderId,
    }
  )

  return {
    buffer,
    driveUrl: driveFile.webViewLink ?? undefined,
  }
}
