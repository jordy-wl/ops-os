'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePortal } from '@/components/portal/portal-context'
import {
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  MessageSquarePlus,
  Clock,
  Send,
} from 'lucide-react'

interface PreviousRequest {
  id: string
  category: string
  subject: string
  status: string
  created_at: string
}

const CATEGORIES = [
  'General Inquiry',
  'Document Request',
  'Change Request',
  'Billing',
  'Technical Support',
  'Other',
]

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
}

function formatTypeName(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function PortalRequestsPage() {
  const { token } = usePortal()

  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const [previousRequests, setPreviousRequests] = useState<PreviousRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchRequests() {
      setLoadingRequests(true)
      setLoadError(null)
      try {
        const res = await fetch(`/api/portal/${token}/requests`)
        if (!cancelled && res.ok) {
          const data = await res.json()
          setPreviousRequests(Array.isArray(data) ? data : data.data ?? [])
        }
      } catch {
        if (!cancelled) {
          setLoadError('Could not load previous requests.')
        }
      } finally {
        if (!cancelled) {
          setLoadingRequests(false)
        }
      }
    }

    fetchRequests()

    return () => {
      cancelled = true
    }
  }, [token])

  const validate = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (!category) errors.category = 'Please select a category'
    if (!subject.trim()) errors.subject = 'Subject is required'
    if (subject.trim().length > 200) errors.subject = 'Subject must be 200 characters or less'
    if (!description.trim()) errors.description = 'Description is required'
    if (description.trim().length > 2000) errors.description = 'Description must be 2000 characters or less'
    return errors
  }, [category, subject, description])

  const handleSubmit = useCallback(async () => {
    const errors = validate()
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/portal/${token}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          description: description.trim(),
          priority,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'Failed to submit request')
      }

      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [token, category, subject, description, priority, validate])

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <CheckCircle2
          className="w-12 h-12 mx-auto mb-4"
          style={{ color: 'var(--portal-primary)' }}
        />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Request Submitted
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Your request has been submitted successfully. We will get back to you as soon as possible.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false)
            setCategory('')
            setSubject('')
            setDescription('')
            setPriority('medium')
            setValidationErrors({})
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
            border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
        >
          Submit Another Request
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6">
        Submit a Request
      </h1>

      {/* Request Form */}
      <div className="max-w-xl mx-auto">
        <div className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6 space-y-4">
          {/* Category */}
          <div>
            <label htmlFor="request-category" className="block text-sm font-medium text-gray-700 mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="request-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setValidationErrors((prev) => {
                  const next = { ...prev }
                  delete next.category
                  return next
                })
              }}
              className={`w-full rounded-md border px-3 py-2.5 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
                min-h-[48px]
                ${validationErrors.category ? 'border-red-300' : 'border-gray-300'}`}
            >
              <option value="">Select a category...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {validationErrors.category && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.category}</p>
            )}
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="request-subject" className="block text-sm font-medium text-gray-700 mb-1.5">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              id="request-subject"
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value)
                setValidationErrors((prev) => {
                  const next = { ...prev }
                  delete next.subject
                  return next
                })
              }}
              maxLength={200}
              placeholder="Brief summary of your request"
              className={`w-full rounded-md border px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
                min-h-[48px]
                ${validationErrors.subject ? 'border-red-300' : 'border-gray-300'}`}
            />
            {validationErrors.subject && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.subject}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="request-description" className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="request-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setValidationErrors((prev) => {
                  const next = { ...prev }
                  delete next.description
                  return next
                })
              }}
              maxLength={2000}
              rows={5}
              placeholder="Describe your request in detail..."
              className={`w-full rounded-md border px-3 py-2.5 text-sm resize-y
                focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
                ${validationErrors.description ? 'border-red-300' : 'border-gray-300'}`}
            />
            <div className="flex justify-between items-center mt-1">
              {validationErrors.description ? (
                <p className="text-red-500 text-xs">{validationErrors.description}</p>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-400">{description.length}/2000</span>
            </div>
          </div>

          {/* Priority */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">
              Priority <span className="text-gray-400 font-normal">(optional)</span>
            </legend>
            <div className="flex gap-3">
              {PRIORITIES.map((p) => (
                <label
                  key={p.value}
                  className={`flex-1 text-center rounded-md border px-3 py-2 text-sm font-medium cursor-pointer transition-colors min-h-[44px] flex items-center justify-center
                    ${
                      priority === p.value
                        ? 'border-[var(--portal-primary)] bg-[var(--portal-primary)]/10 text-[var(--portal-primary)]'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={p.value}
                    checked={priority === p.value}
                    onChange={(e) => setPriority(e.target.value)}
                    className="sr-only"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Error message */}
          {submitError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium
              bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)]
              hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Request
              </>
            )}
          </button>
        </div>

        {/* Previous Requests */}
        <section aria-labelledby="previous-requests-heading" className="mt-8">
          <h2
            id="previous-requests-heading"
            className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2"
          >
            <MessageSquarePlus className="w-4 h-4 text-gray-500" aria-hidden="true" />
            Previous Requests
          </h2>

          {loadingRequests ? (
            <div className="animate-pulse space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-4">
                  <div className="h-4 w-32 bg-gray-100 rounded mb-2" />
                  <div className="h-3 w-48 bg-gray-50 rounded" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="text-center py-6 text-sm text-gray-500">
              {loadError}
            </div>
          ) : previousRequests.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
              <p className="text-sm text-gray-500">No previous requests.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {previousRequests.map((req) => (
                <article
                  key={req.id}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[req.status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {formatTypeName(req.status)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {req.category}
                    </span>
                    <span className="text-xs text-gray-300 ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {formatDate(req.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 font-medium">
                    {req.subject}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
