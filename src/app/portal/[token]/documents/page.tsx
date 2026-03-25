'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePortal } from '@/components/portal/portal-context'
import {
  FileText,
  Download,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  ClipboardList,
  CheckCircle2,
  Clock,
} from 'lucide-react'

interface PortalDocument {
  id: string
  title: string
  format: string
  url: string
  created_at: string
}

interface PortalForm {
  id: string
  title: string
  description?: string
  status: 'pending' | 'completed'
  submitted_at?: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const FORMAT_STYLES: Record<string, string> = {
  pdf: 'bg-red-50 text-red-700',
  docx: 'bg-blue-50 text-blue-700',
  doc: 'bg-blue-50 text-blue-700',
  xlsx: 'bg-emerald-50 text-emerald-700',
  xls: 'bg-emerald-50 text-emerald-700',
  csv: 'bg-emerald-50 text-emerald-700',
  pptx: 'bg-orange-50 text-orange-700',
}

function getFormatStyle(format: string): string {
  return FORMAT_STYLES[format.toLowerCase()] || 'bg-slate-100 text-slate-600'
}

export default function PortalDocumentsPage() {
  const { token, portalConfig } = usePortal()

  const [documents, setDocuments] = useState<PortalDocument[]>([])
  const [forms, setForms] = useState<PortalForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        const fetches: Promise<Response>[] = [
          fetch(`/api/portal/${token}/documents`),
        ]

        if (portalConfig.forms_enabled) {
          fetches.push(fetch(`/api/portal/${token}/forms`))
        }

        const responses = await Promise.all(fetches)

        if (!cancelled) {
          if (responses[0].ok) {
            const docsData = await responses[0].json()
            setDocuments(Array.isArray(docsData) ? docsData : docsData.data ?? [])
          }

          if (responses[1]?.ok) {
            const formsData = await responses[1].json()
            setForms(Array.isArray(formsData) ? formsData : formsData.data ?? [])
          }

          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load documents. Please try again.')
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [token, portalConfig.forms_enabled])

  if (loading) {
    return <DocumentsSkeleton showForms={portalConfig.forms_enabled} />
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-[var(--portal-error)]" />
        <p className="text-sm text-[var(--portal-text-secondary)] mb-4">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-[var(--portal-radius-sm)]
            bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)]
            hover:opacity-90 transition-all duration-[var(--portal-transition)] active:scale-[0.98] min-h-[44px]"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-semibold text-[var(--portal-text-primary)] mb-6">
        Documents & Forms
      </h1>

      {/* Documents Section */}
      <section aria-labelledby="documents-heading" className="mb-8">
        <h2
          id="documents-heading"
          className="text-base font-semibold text-[var(--portal-text-primary)] mb-3 flex items-center gap-2"
        >
          <FileText className="w-4 h-4 text-[var(--portal-text-secondary)]" aria-hidden="true" />
          Documents
        </h2>

        {documents.length === 0 ? (
          <div className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-8 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-[var(--portal-text-muted)]" aria-hidden="true" />
            <p className="text-sm text-[var(--portal-text-secondary)]">No documents available yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <article
                key={doc.id}
                className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-4 flex items-center gap-4
                  hover:shadow-[var(--portal-shadow-md)] hover:border-[var(--portal-card-border-hover)]
                  transition-all duration-[var(--portal-transition)]"
              >
                <span
                  className={`inline-flex items-center rounded-[var(--portal-radius-sm)] px-2 py-0.5 text-xs font-semibold uppercase ${getFormatStyle(doc.format)}`}
                >
                  {doc.format}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-[var(--portal-text-primary)] truncate">
                    {doc.title}
                  </h3>
                  <p className="text-xs text-[var(--portal-text-muted)] mt-0.5">
                    {formatDate(doc.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--portal-radius-sm)]
                      border border-[var(--portal-card-border)] text-[var(--portal-text-secondary)]
                      hover:bg-[var(--portal-bg)] hover:border-[var(--portal-card-border-hover)]
                      transition-all duration-[var(--portal-transition)] min-h-[44px] min-w-[44px] justify-center"
                    aria-label={`View ${doc.title}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">View</span>
                  </a>
                  <a
                    href={doc.url}
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--portal-radius-sm)]
                      bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)]
                      hover:opacity-90 transition-all duration-[var(--portal-transition)] active:scale-[0.98]
                      min-h-[44px] min-w-[44px] justify-center"
                    aria-label={`Download ${doc.title}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Forms Section */}
      {portalConfig.forms_enabled && (
        <section aria-labelledby="forms-heading">
          <h2
            id="forms-heading"
            className="text-base font-semibold text-[var(--portal-text-primary)] mb-3 flex items-center gap-2"
          >
            <ClipboardList className="w-4 h-4 text-[var(--portal-text-secondary)]" aria-hidden="true" />
            Forms
          </h2>

          {forms.length === 0 ? (
            <div className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-8 text-center">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-[var(--portal-text-muted)]" aria-hidden="true" />
              <p className="text-sm text-[var(--portal-text-secondary)]">No forms available.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {forms.map((form) => {
                const isPending = form.status === 'pending'
                return (
                  <article
                    key={form.id}
                    className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-4 flex items-center gap-4
                      hover:shadow-[var(--portal-shadow-md)] hover:border-[var(--portal-card-border-hover)]
                      transition-all duration-[var(--portal-transition)]"
                  >
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isPending
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {isPending ? (
                        <Clock className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      )}
                      {isPending ? 'Pending' : 'Submitted'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-[var(--portal-text-primary)] truncate">
                        {form.title}
                      </h3>
                      {form.description && (
                        <p className="text-xs text-[var(--portal-text-muted)] mt-0.5 truncate">
                          {form.description}
                        </p>
                      )}
                      {form.submitted_at && (
                        <p className="text-xs text-[var(--portal-text-muted)] mt-0.5">
                          Submitted {formatDate(form.submitted_at)}
                        </p>
                      )}
                    </div>
                    {isPending && (
                      <Link
                        href={`/portal/${token}/forms/${form.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-[var(--portal-radius-sm)]
                          bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)]
                          hover:opacity-90 transition-all duration-[var(--portal-transition)] active:scale-[0.98] min-h-[44px]"
                      >
                        Fill Out
                      </Link>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function DocumentsSkeleton({ showForms = false }: { showForms?: boolean }) {
  return (
    <div>
      <div className="h-7 w-48 rounded-[var(--portal-radius-sm)] portal-shimmer mb-6" />

      {/* Documents skeleton */}
      <div className="mb-8">
        <div className="h-5 w-24 rounded portal-shimmer mb-3" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] p-4 flex items-center gap-4">
              <div className="h-5 w-10 rounded portal-shimmer" />
              <div className="flex-1">
                <div className="h-4 w-40 rounded portal-shimmer mb-1" />
                <div className="h-3 w-20 rounded portal-shimmer" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-16 rounded portal-shimmer" />
                <div className="h-8 w-20 rounded portal-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Forms skeleton */}
      {showForms && (
        <div>
          <div className="h-5 w-16 rounded portal-shimmer mb-3" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] p-4 flex items-center gap-4">
                <div className="h-5 w-16 rounded-full portal-shimmer" />
                <div className="flex-1">
                  <div className="h-4 w-36 rounded portal-shimmer" />
                </div>
                <div className="h-8 w-20 rounded portal-shimmer" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
