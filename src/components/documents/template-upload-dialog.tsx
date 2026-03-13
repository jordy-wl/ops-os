'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const CATEGORIES = [
  { value: 'contract', label: 'Contract' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'nda', label: 'NDA' },
  { value: 'report', label: 'Report' },
  { value: 'letter', label: 'Letter' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'other', label: 'Other' },
]

const ACCEPTED_TYPES = [
  'application/pdf',
  'text/html',
  'text/markdown',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const ACCEPTED_EXTENSIONS = '.pdf,.html,.htm,.md,.txt,.docx'
const MAX_SIZE_MB = 50
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

interface TemplateUploadDialogProps {
  open: boolean
  onClose: () => void
}

export function TemplateUploadDialog({ open, onClose }: TemplateUploadDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('other')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<'idle' | 'uploading' | 'extracting' | 'done'>('idle')

  const resetForm = useCallback(() => {
    setName('')
    setCategory('other')
    setFile(null)
    setError(null)
    setProgress('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleClose = useCallback(() => {
    if (!uploading) {
      resetForm()
      onClose()
    }
  }, [uploading, resetForm, onClose])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setError(null)

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError('Unsupported file type. Accepted: PDF, HTML, Markdown, DOCX, Text')
      return
    }

    if (selected.size > MAX_SIZE_BYTES) {
      setError(`File exceeds ${MAX_SIZE_MB}MB limit`)
      return
    }

    setFile(selected)
    // Auto-fill name from filename if empty
    if (!name) {
      const baseName = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      setName(baseName.charAt(0).toUpperCase() + baseName.slice(1))
    }
  }, [name])

  const handleUpload = useCallback(async () => {
    if (!file || !name.trim()) return

    setUploading(true)
    setError(null)
    setProgress('uploading')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name.trim())
      formData.append('category', category)

      setProgress('extracting')

      const res = await fetch('/api/documents/templates', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message ?? `Upload failed (${res.status})`)
      }

      setProgress('done')
      router.refresh()

      // Brief delay to show success state
      setTimeout(() => {
        resetForm()
        onClose()
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setProgress('idle')
    } finally {
      setUploading(false)
    }
  }, [file, name, category, router, resetForm, onClose])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Reference Template</DialogTitle>
          <DialogDescription className="sr-only">
            Upload a reference file to create a new document template.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        {progress === 'done' && (
          <div className="mb-4 rounded-md bg-success/10 border border-success/20 px-4 py-3 text-[13px] text-success" role="status">
            Template uploaded and analyzed successfully.
          </div>
        )}

        <div className="space-y-4">
          {/* File picker */}
          <div>
            <label htmlFor="template-file" className="block text-sm font-medium text-foreground mb-1">
              Reference File
            </label>
            <input
              ref={fileInputRef}
              id="template-file"
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 cursor-pointer"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, HTML, Markdown, DOCX, or plain text. Max {MAX_SIZE_MB}MB.
            </p>
          </div>

          {/* Template name */}
          <div>
            <label htmlFor="template-name" className="block text-sm font-medium text-foreground mb-1">
              Template Name
            </label>
            <Input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Client Onboarding Proposal"
              disabled={uploading}
              className="text-sm"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="template-category" className="block text-sm font-medium text-foreground mb-1">
              Category
            </label>
            <select
              id="template-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={uploading}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              AI may suggest a different category based on content analysis.
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        {uploading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {progress === 'uploading' && 'Uploading file...'}
            {progress === 'extracting' && 'Analyzing structure with AI...'}
          </div>
        )}

        {/* Actions */}
        <DialogFooter className="mt-6 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={uploading || !file || !name.trim()}
          >
            {uploading ? 'Uploading...' : 'Upload Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
