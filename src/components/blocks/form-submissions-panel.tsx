'use client'

import { useState, useEffect } from 'react'
import { FileText, ChevronDown, ChevronRight } from 'lucide-react'

interface FormSubmission {
  id: string
  shared_link_id: string
  field_data: Record<string, unknown>
  respondent_name: string | null
  respondent_email: string | null
  submitted_at: string
}

interface FormSubmissionsPanelProps {
  blockId: string
}

export function FormSubmissionsPanel({ blockId }: FormSubmissionsPanelProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/blocks/${blockId}/submissions`)
        if (!res.ok) return
        const body = await res.json()
        setSubmissions(body.data ?? [])
      } catch {
        // Silent — panel is non-critical
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [blockId])

  if (loading) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Form Submissions
        </h2>
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-muted rounded" />
          <div className="h-8 bg-muted rounded" />
        </div>
      </section>
    )
  }

  if (submissions.length === 0) return null

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Form Submissions
        <span className="text-xs text-muted-foreground font-normal">({submissions.length})</span>
      </h2>
      <div className="rounded-lg border border-border divide-y divide-border">
        {submissions.map((sub) => (
          <div key={sub.id}>
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {expandedId === sub.id ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="truncate text-foreground">
                  {sub.respondent_name ?? sub.respondent_email ?? 'Anonymous'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">
                {new Date(sub.submitted_at).toLocaleDateString()}
              </span>
            </button>
            {expandedId === sub.id && (
              <div className="px-3 pb-3 pt-1">
                {sub.respondent_email && (
                  <p className="text-xs text-muted-foreground mb-2">{sub.respondent_email}</p>
                )}
                <dl className="text-sm space-y-1.5">
                  {Object.entries(sub.field_data).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <dt className="text-muted-foreground capitalize shrink-0 w-28">
                        {key.replace(/_/g, ' ')}
                      </dt>
                      <dd className="text-foreground break-words">
                        {val == null ? '—' : String(val)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
