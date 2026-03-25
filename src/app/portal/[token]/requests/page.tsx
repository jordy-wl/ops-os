'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePortal } from '@/components/portal/portal-context'
import {
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  MessageSquarePlus,
  Clock,
  Send,
  ArrowLeft,
  GitBranch,
  FileText,
} from 'lucide-react'
import {
  type FormQuestion,
  evaluateBranching,
  LIKERT_LABELS_DEFAULT,
} from '@/lib/form-types'

// --- Types ---

interface RequestType {
  workflow_template_id: string
  form_template_id?: string
  display_name?: string
  workflow_name: string
  workflow_description?: string
}

interface PreviousRequest {
  id: string
  category?: string
  subject?: string
  status: string
  created_at: string
  workflow_template_name?: string
  workflow_instance_status?: string
  current_step_name?: string
  current_step_index?: number
  total_steps?: number
}

interface FormTemplate {
  id: string
  title: string
  description?: string
  questions: FormQuestion[]
  collect_contact?: boolean
}

// --- Constants ---

const LEGACY_CATEGORIES = [
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

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-blue-50', text: 'text-blue-700' },
  open: { bg: 'bg-blue-50', text: 'text-blue-700' },
  running: { bg: 'bg-amber-50', text: 'text-amber-700' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700' },
  done: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  closed: { bg: 'bg-slate-100', text: 'text-slate-600' },
  failed: { bg: 'bg-red-50', text: 'text-red-700' },
}

const EMOJI_OPTIONS = ['1f600', '1f610', '1f641', '1f622', '1f621']
const EMOJI_CHARS = ['\u{1F600}', '\u{1F610}', '\u{1F641}', '\u{1F622}', '\u{1F621}']

const POLL_INTERVAL_MS = 30000

// --- Helpers ---

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

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600' }
}

// --- Step: Type selection | Form | Legacy form | Success ---

type RequestStep = 'select-type' | 'fill-form' | 'legacy-form' | 'success'

// --- Main component ---

export default function PortalRequestsPage() {
  const { token } = usePortal()

  // Request types from API
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)

  // Previous requests
  const [previousRequests, setPreviousRequests] = useState<PreviousRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Multi-step flow
  const [step, setStep] = useState<RequestStep>('select-type')
  const [selectedType, setSelectedType] = useState<RequestType | null>(null)

  // Form template (loaded when a request type has a form)
  const [formTemplate, setFormTemplate] = useState<FormTemplate | null>(null)
  const [loadingForm, setLoadingForm] = useState(false)
  const [formAnswers, setFormAnswers] = useState<Record<string, unknown>>({})
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  // Legacy form fields
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // --- Data fetching ---

  useEffect(() => {
    let cancelled = false

    async function fetchRequestTypes() {
      setLoadingTypes(true)
      try {
        const res = await fetch(`/api/portal/${token}/request-types`)
        if (!cancelled && res.ok) {
          const data = await res.json()
          const types = Array.isArray(data) ? data : data.data ?? []
          setRequestTypes(types)
          // If no request types configured, go straight to legacy form
          if (types.length === 0) {
            setStep('legacy-form')
          }
        } else if (!cancelled) {
          // API might not exist yet -- fall back to legacy
          setStep('legacy-form')
        }
      } catch {
        if (!cancelled) {
          // Fall back to legacy form on error
          setStep('legacy-form')
        }
      } finally {
        if (!cancelled) setLoadingTypes(false)
      }
    }

    fetchRequestTypes()
    return () => { cancelled = true }
  }, [token])

  // Fetch previous requests + polling
  const fetchPreviousRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/${token}/requests`)
      if (res.ok) {
        const data = await res.json()
        setPreviousRequests(Array.isArray(data) ? data : data.data ?? [])
      }
    } catch {
      setLoadError('Could not load previous requests.')
    } finally {
      setLoadingRequests(false)
    }
  }, [token])

  useEffect(() => {
    fetchPreviousRequests()

    const interval = setInterval(fetchPreviousRequests, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchPreviousRequests])

  // Fetch form template when a request type with a form is selected
  useEffect(() => {
    if (!selectedType?.form_template_id) {
      setFormTemplate(null)
      return
    }

    let cancelled = false
    setLoadingForm(true)

    async function loadForm() {
      try {
        const res = await fetch(
          `/api/portal/${token}/forms/${selectedType!.form_template_id}`
        )
        if (!cancelled && res.ok) {
          const data = await res.json()
          setFormTemplate(data.data ?? data)
        }
      } catch {
        // Form load failed -- allow submission without form
        if (!cancelled) setFormTemplate(null)
      } finally {
        if (!cancelled) setLoadingForm(false)
      }
    }

    loadForm()
    return () => { cancelled = true }
  }, [token, selectedType])

  // --- Visible questions (branching) ---

  const visibleQuestions = useMemo(() => {
    if (!formTemplate) return []
    return formTemplate.questions.filter((q) => {
      if (!q.branching) return true
      return evaluateBranching(q.branching, formAnswers)
    })
  }, [formTemplate, formAnswers])

  // --- Handlers ---

  const handleSelectType = useCallback((rt: RequestType) => {
    setSelectedType(rt)
    setFormAnswers({})
    setContactName('')
    setContactEmail('')
    setSubject('')
    setDescription('')
    setPriority('medium')
    setValidationErrors({})
    setSubmitError(null)
    setStep('fill-form')
  }, [])

  const handleBack = useCallback(() => {
    if (requestTypes.length > 0) {
      setStep('select-type')
      setSelectedType(null)
      setFormTemplate(null)
    }
  }, [requestTypes])

  const setFormAnswer = useCallback((questionId: string, value: unknown) => {
    setFormAnswers((prev) => ({ ...prev, [questionId]: value }))
    setValidationErrors((prev) => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
  }, [])

  // --- Validation ---

  const validateLegacy = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (!category) errors.category = 'Please select a category'
    if (!subject.trim()) errors.subject = 'Subject is required'
    if (subject.trim().length > 200) errors.subject = 'Subject must be 200 characters or less'
    if (!description.trim()) errors.description = 'Description is required'
    if (description.trim().length > 2000) errors.description = 'Description must be 2000 characters or less'
    return errors
  }, [category, subject, description])

  const validateWorkflowRequest = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {}

    // Validate form answers if a form template is loaded
    if (formTemplate) {
      for (const q of visibleQuestions) {
        if (q.required) {
          const val = formAnswers[q.id]
          if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) {
            errors[q.id] = `${q.label} is required`
          }
        }
        if (q.type === 'url' && formAnswers[q.id]) {
          const urlVal = String(formAnswers[q.id])
          if (urlVal && !/^https?:\/\/.+/.test(urlVal)) {
            errors[q.id] = 'Please enter a valid URL starting with http:// or https://'
          }
        }
        if (q.max_length && typeof formAnswers[q.id] === 'string') {
          if ((formAnswers[q.id] as string).length > q.max_length) {
            errors[q.id] = `Must be ${q.max_length} characters or less`
          }
        }
      }

      if (formTemplate.collect_contact && contactEmail) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
          errors['_contact_email'] = 'Please enter a valid email address'
        }
      }
    } else {
      // No form template -- require subject + description
      if (!subject.trim()) errors.subject = 'Subject is required'
      if (!description.trim()) errors.description = 'Description is required'
    }

    return errors
  }, [formTemplate, visibleQuestions, formAnswers, contactEmail, subject, description])

  // --- Submit ---

  const handleSubmitLegacy = useCallback(async () => {
    const errors = validateLegacy()
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

      setStep('success')
      fetchPreviousRequests()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [token, category, subject, description, priority, validateLegacy, fetchPreviousRequests])

  const handleSubmitWorkflow = useCallback(async () => {
    if (!selectedType) return

    const errors = validateWorkflowRequest()
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload: Record<string, unknown> = {
        workflow_template_id: selectedType.workflow_template_id,
        priority,
      }

      if (formTemplate) {
        payload.responses = formAnswers
        if (contactName) payload.respondent_name = contactName
        if (contactEmail) payload.respondent_email = contactEmail
      } else {
        payload.subject = subject.trim()
        payload.description = description.trim()
      }

      const res = await fetch(`/api/portal/${token}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'Failed to submit request')
      }

      setStep('success')
      fetchPreviousRequests()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [
    token, selectedType, formTemplate, formAnswers,
    contactName, contactEmail, subject, description, priority,
    validateWorkflowRequest, fetchPreviousRequests,
  ])

  const handleReset = useCallback(() => {
    setStep(requestTypes.length > 0 ? 'select-type' : 'legacy-form')
    setSelectedType(null)
    setFormTemplate(null)
    setFormAnswers({})
    setContactName('')
    setContactEmail('')
    setCategory('')
    setSubject('')
    setDescription('')
    setPriority('medium')
    setValidationErrors({})
    setSubmitError(null)
  }, [requestTypes])

  // --- Render: Success ---

  if (step === 'success') {
    return (
      <div>
        <div className="max-w-xl mx-auto text-center py-12">
          <CheckCircle2
            className="w-12 h-12 mx-auto mb-4"
            style={{ color: 'var(--portal-primary)' }}
          />
          <h1 className="text-xl font-semibold text-[var(--portal-text-primary)] mb-2">
            Request Submitted
          </h1>
          <p className="text-sm text-[var(--portal-text-secondary)] mb-6">
            Your request has been submitted successfully. You can track its progress below.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-[var(--portal-radius-sm)]
              border border-[var(--portal-card-border)] text-[var(--portal-text-secondary)]
              hover:bg-[var(--portal-bg)] hover:border-[var(--portal-card-border-hover)]
              transition-all duration-[var(--portal-transition)] min-h-[44px]"
          >
            Submit Another Request
          </button>
        </div>

        <PreviousRequestsSection
          requests={previousRequests}
          loading={loadingRequests}
          error={loadError}
        />
      </div>
    )
  }

  // --- Render: Loading types ---

  if (loadingTypes) {
    return (
      <div>
        <div className="h-7 w-48 rounded-[var(--portal-radius-sm)] portal-shimmer mb-6" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] p-5">
              <div className="h-5 w-32 rounded portal-shimmer mb-2" />
              <div className="h-4 w-full rounded portal-shimmer" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- Render: Select request type ---

  if (step === 'select-type' && requestTypes.length > 0) {
    return (
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--portal-text-primary)] mb-2">
          Submit a Request
        </h1>
        <p className="text-sm text-[var(--portal-text-secondary)] mb-6">
          Select the type of request you would like to submit.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {requestTypes.map((rt) => (
            <button
              key={rt.workflow_template_id}
              type="button"
              onClick={() => handleSelectType(rt)}
              className="text-left rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-5
                hover:border-[var(--portal-primary)]/40 hover:shadow-[var(--portal-shadow-md)]
                transition-all duration-[var(--portal-transition)] min-h-[44px] focus:outline-none focus:ring-2
                focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-[var(--portal-radius)] flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--portal-primary)', opacity: 0.1 }}
                >
                  <GitBranch
                    className="w-5 h-5"
                    style={{ color: 'var(--portal-primary)' }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--portal-text-primary)]">
                    {rt.display_name || rt.workflow_name}
                  </p>
                  {rt.workflow_description && (
                    <p className="text-xs text-[var(--portal-text-secondary)] mt-1 line-clamp-2">
                      {rt.workflow_description}
                    </p>
                  )}
                  {rt.form_template_id && (
                    <span className="inline-flex items-center gap-1 mt-2 text-[10px] text-[var(--portal-text-muted)]">
                      <FileText className="w-3 h-3" aria-hidden="true" />
                      Includes intake form
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <PreviousRequestsSection
          requests={previousRequests}
          loading={loadingRequests}
          error={loadError}
        />
      </div>
    )
  }

  // --- Render: Workflow request form ---

  if (step === 'fill-form' && selectedType) {
    return (
      <div>
        {/* Back button */}
        {requestTypes.length > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--portal-text-secondary)] hover:text-[var(--portal-text-primary)]
              transition-colors duration-[var(--portal-transition)] mb-4 min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to request types
          </button>
        )}

        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--portal-text-primary)] mb-1">
          {selectedType.display_name || selectedType.workflow_name}
        </h1>
        {selectedType.workflow_description && (
          <p className="text-sm text-[var(--portal-text-secondary)] mb-6">
            {selectedType.workflow_description}
          </p>
        )}

        <div className="max-w-xl mx-auto">
          {loadingForm ? (
            <FormSkeleton />
          ) : formTemplate ? (
            /* Render form template */
            <div className="space-y-4">
              {/* Contact info */}
              {formTemplate.collect_contact && (
                <div className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-4 sm:p-5 space-y-3
                  focus-within:ring-2 focus-within:ring-[var(--portal-primary)]/20 transition-shadow duration-[var(--portal-transition)]">
                  <p className="text-sm font-medium text-[var(--portal-text-primary)]">Your Information</p>
                  <div>
                    <label htmlFor="rt-contact-name" className="block text-xs font-medium text-[var(--portal-text-secondary)] mb-1">
                      Name
                    </label>
                    <input
                      id="rt-contact-name"
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full rounded-md border border-[var(--portal-card-border)] px-3 py-2.5 text-sm
                        focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
                        min-h-[48px]"
                    />
                  </div>
                  <div>
                    <label htmlFor="rt-contact-email" className="block text-xs font-medium text-[var(--portal-text-secondary)] mb-1">
                      Email
                    </label>
                    <input
                      id="rt-contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => {
                        setContactEmail(e.target.value)
                        setValidationErrors((prev) => {
                          const next = { ...prev }
                          delete next['_contact_email']
                          return next
                        })
                      }}
                      placeholder="your@email.com"
                      className={`w-full rounded-md border px-3 py-2.5 text-sm
                        focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
                        min-h-[48px]
                        ${validationErrors['_contact_email'] ? 'border-red-300' : 'border-[var(--portal-card-border)]'}`}
                    />
                    {validationErrors['_contact_email'] && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors['_contact_email']}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Questions */}
              {formTemplate.questions.map((question) => {
                const isVisible = !question.branching || evaluateBranching(question.branching, formAnswers)
                return (
                  <div
                    key={question.id}
                    className="transition-all duration-300 ease-in-out"
                    style={{
                      maxHeight: isVisible ? '800px' : '0',
                      opacity: isVisible ? 1 : 0,
                      overflow: 'hidden',
                    }}
                  >
                    {isVisible && (
                      <QuestionField
                        question={question}
                        value={formAnswers[question.id]}
                        onChange={(val) => setFormAnswer(question.id, val)}
                        error={validationErrors[question.id]}
                      />
                    )}
                  </div>
                )
              })}

              {/* Priority */}
              <PrioritySelector priority={priority} onChange={setPriority} />

              {/* Errors */}
              {submitError && <SubmitErrorBanner message={submitError} />}

              {/* Submit */}
              <SubmitButton onClick={handleSubmitWorkflow} loading={submitting} />
            </div>
          ) : (
            /* No form template -- show subject + description fields */
            <div className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-5 sm:p-6 space-y-4">
              <div>
                <label htmlFor="wf-subject" className="block text-sm font-medium text-[var(--portal-text-primary)] mb-1.5">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  id="wf-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value)
                    setValidationErrors((prev) => { const n = { ...prev }; delete n.subject; return n })
                  }}
                  maxLength={200}
                  placeholder="Brief summary of your request"
                  className={`w-full rounded-md border px-3 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
                    min-h-[48px]
                    ${validationErrors.subject ? 'border-red-300' : 'border-[var(--portal-card-border)]'}`}
                />
                {validationErrors.subject && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.subject}</p>
                )}
              </div>

              <div>
                <label htmlFor="wf-description" className="block text-sm font-medium text-[var(--portal-text-primary)] mb-1.5">
                  Description <span className="text-[var(--portal-error)]">*</span>
                </label>
                <textarea
                  id="wf-description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    setValidationErrors((prev) => { const n = { ...prev }; delete n.description; return n })
                  }}
                  maxLength={2000}
                  rows={5}
                  placeholder="Describe your request in detail..."
                  className={`w-full rounded-[var(--portal-radius-sm)] border px-3 py-2.5 text-sm resize-y
                    focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
                    transition-[border-color,box-shadow] duration-[var(--portal-transition)]
                    ${validationErrors.description ? 'border-red-300' : 'border-[var(--portal-card-border)]'}`}
                />
                <div className="flex justify-between items-center mt-1">
                  {validationErrors.description ? (
                    <p className="text-[var(--portal-error)] text-xs">{validationErrors.description}</p>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-[var(--portal-text-muted)]">{description.length}/2000</span>
                </div>
              </div>

              <PrioritySelector priority={priority} onChange={setPriority} />

              {submitError && <SubmitErrorBanner message={submitError} />}

              <SubmitButton onClick={handleSubmitWorkflow} loading={submitting} />
            </div>
          )}
        </div>

        <PreviousRequestsSection
          requests={previousRequests}
          loading={loadingRequests}
          error={loadError}
        />
      </div>
    )
  }

  // --- Render: Legacy form (no request types configured) ---

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-semibold text-[var(--portal-text-primary)] mb-6">
        Submit a Request
      </h1>

      <div className="max-w-xl mx-auto">
        <div className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-5 sm:p-6 space-y-4">
          {/* Category */}
          <div>
            <label htmlFor="request-category" className="block text-sm font-medium text-[var(--portal-text-primary)] mb-1.5">
              Category <span className="text-[var(--portal-error)]">*</span>
            </label>
            <select
              id="request-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setValidationErrors((prev) => { const n = { ...prev }; delete n.category; return n })
              }}
              className={`w-full rounded-[var(--portal-radius-sm)] border px-3 py-2.5 text-sm bg-[var(--portal-card-bg)]
                focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
                transition-[border-color,box-shadow] duration-[var(--portal-transition)]
                min-h-[48px]
                ${validationErrors.category ? 'border-red-300' : 'border-[var(--portal-card-border)]'}`}
            >
              <option value="">Select a category...</option>
              {LEGACY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {validationErrors.category && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.category}</p>
            )}
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="request-subject" className="block text-sm font-medium text-[var(--portal-text-primary)] mb-1.5">
              Subject <span className="text-[var(--portal-error)]">*</span>
            </label>
            <input
              id="request-subject"
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value)
                setValidationErrors((prev) => { const n = { ...prev }; delete n.subject; return n })
              }}
              maxLength={200}
              placeholder="Brief summary of your request"
              className={`w-full rounded-[var(--portal-radius-sm)] border px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
                transition-[border-color,box-shadow] duration-[var(--portal-transition)]
                min-h-[48px]
                ${validationErrors.subject ? 'border-red-300' : 'border-[var(--portal-card-border)]'}`}
            />
            {validationErrors.subject && (
              <p className="text-[var(--portal-error)] text-xs mt-1">{validationErrors.subject}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="request-description" className="block text-sm font-medium text-[var(--portal-text-primary)] mb-1.5">
              Description <span className="text-[var(--portal-error)]">*</span>
            </label>
            <textarea
              id="request-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setValidationErrors((prev) => { const n = { ...prev }; delete n.description; return n })
              }}
              maxLength={2000}
              rows={5}
              placeholder="Describe your request in detail..."
              className={`w-full rounded-[var(--portal-radius-sm)] border px-3 py-2.5 text-sm resize-y
                focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
                transition-[border-color,box-shadow] duration-[var(--portal-transition)]
                ${validationErrors.description ? 'border-red-300' : 'border-[var(--portal-card-border)]'}`}
            />
            <div className="flex justify-between items-center mt-1">
              {validationErrors.description ? (
                <p className="text-[var(--portal-error)] text-xs">{validationErrors.description}</p>
              ) : (
                <span />
              )}
              <span className="text-xs text-[var(--portal-text-muted)]">{description.length}/2000</span>
            </div>
          </div>

          {/* Priority */}
          <PrioritySelector priority={priority} onChange={setPriority} />

          {/* Error message */}
          {submitError && <SubmitErrorBanner message={submitError} />}

          {/* Submit */}
          <SubmitButton onClick={handleSubmitLegacy} loading={submitting} />
        </div>

        <PreviousRequestsSection
          requests={previousRequests}
          loading={loadingRequests}
          error={loadError}
        />
      </div>
    </div>
  )
}

// ─── Shared Sub-Components ──────────────────────────────────────

interface PrioritySelectorProps {
  priority: string
  onChange: (value: string) => void
}

function PrioritySelector({ priority, onChange }: PrioritySelectorProps) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-[var(--portal-text-primary)] mb-2">
        Priority <span className="text-[var(--portal-text-muted)] font-normal">(optional)</span>
      </legend>
      <div className="flex gap-3">
        {PRIORITIES.map((p) => (
          <label
            key={p.value}
            className={`flex-1 text-center rounded-[var(--portal-radius-sm)] border px-3 py-2 text-sm font-medium cursor-pointer
              transition-all duration-[var(--portal-transition)] min-h-[44px] flex items-center justify-center
              ${
                priority === p.value
                  ? 'border-[var(--portal-primary)] bg-[var(--portal-primary)]/10 text-[var(--portal-primary)]'
                  : 'border-[var(--portal-card-border)] text-[var(--portal-text-secondary)] hover:bg-[var(--portal-bg)]'
              }`}
          >
            <input
              type="radio"
              name="priority"
              value={p.value}
              checked={priority === p.value}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
            />
            {p.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface SubmitErrorBannerProps {
  message: string
}

function SubmitErrorBanner({ message }: SubmitErrorBannerProps) {
  return (
    <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  )
}

interface SubmitButtonProps {
  onClick: () => void
  loading: boolean
}

function SubmitButton({ onClick, loading }: SubmitButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full inline-flex items-center justify-center gap-2 rounded-[var(--portal-radius-sm)] px-4 py-2.5 text-sm font-medium
        bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)]
        hover:opacity-90 transition-all duration-[var(--portal-transition)]
        active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
    >
      {loading ? (
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
  )
}

// ─── Previous Requests ──────────────────────────────────────────

interface PreviousRequestsSectionProps {
  requests: PreviousRequest[]
  loading: boolean
  error: string | null
}

function PreviousRequestsSection({ requests, loading, error }: PreviousRequestsSectionProps) {
  if (loading && requests.length === 0) {
    return (
      <section aria-labelledby="previous-requests-heading" className="mt-8 max-w-xl mx-auto">
        <h2
          id="previous-requests-heading"
          className="text-base font-semibold text-[var(--portal-text-primary)] mb-3 flex items-center gap-2"
        >
          <MessageSquarePlus className="w-4 h-4 text-[var(--portal-text-secondary)]" aria-hidden="true" />
          Previous Requests
        </h2>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] p-4">
              <div className="h-4 w-32 rounded portal-shimmer mb-2" />
              <div className="h-3 w-48 rounded portal-shimmer" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="previous-requests-heading" className="mt-8 max-w-xl mx-auto">
      <h2
        id="previous-requests-heading"
        className="text-base font-semibold text-[var(--portal-text-primary)] mb-3 flex items-center gap-2"
      >
        <MessageSquarePlus className="w-4 h-4 text-[var(--portal-text-secondary)]" aria-hidden="true" />
        Previous Requests
      </h2>

      {error ? (
        <div className="text-center py-6 text-sm text-[var(--portal-text-secondary)]">{error}</div>
      ) : requests.length === 0 ? (
        <div className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-6 text-center">
          <p className="text-sm text-[var(--portal-text-secondary)]">No previous requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const displayStatus = req.workflow_instance_status ?? req.status
            const style = getStatusStyle(displayStatus)

            return (
              <article
                key={req.id}
                className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-4
                  hover:shadow-[var(--portal-shadow-sm)] hover:border-[var(--portal-card-border-hover)]
                  transition-all duration-[var(--portal-transition)]"
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                  >
                    {formatTypeName(displayStatus)}
                  </span>
                  {req.workflow_template_name && (
                    <span className="text-xs text-[var(--portal-text-muted)]">
                      {req.workflow_template_name}
                    </span>
                  )}
                  {!req.workflow_template_name && req.category && (
                    <span className="text-xs text-[var(--portal-text-muted)]">
                      {req.category}
                    </span>
                  )}
                  <span className="text-xs text-[var(--portal-text-muted)] ml-auto flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {formatDate(req.created_at)}
                  </span>
                </div>

                {req.subject && (
                  <p className="text-sm text-[var(--portal-text-primary)] font-medium">
                    {req.subject}
                  </p>
                )}

                {/* Workflow step progress */}
                {req.current_step_name && req.total_steps != null && req.total_steps > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-[var(--portal-text-muted)] mb-1">
                      <span>
                        Step {(req.current_step_index ?? 0) + 1} of {req.total_steps}:{' '}
                        <span className="text-[var(--portal-text-secondary)]">{req.current_step_name}</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--portal-card-border)]/40 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round(
                            (((req.current_step_index ?? 0) + 1) / req.total_steps) * 100
                          )}%`,
                          backgroundColor: 'var(--portal-primary)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── Question Field Component ───────────────────────────────────

interface QuestionFieldProps {
  question: FormQuestion
  value: unknown
  onChange: (value: unknown) => void
  error?: string
}

function QuestionField({ question, value, onChange, error }: QuestionFieldProps) {
  const id = `q-${question.id}`

  const inputBase = `w-full rounded-[var(--portal-radius-sm)] border px-3 py-2.5 text-sm
    focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
    transition-[border-color,box-shadow] duration-[var(--portal-transition)]
    min-h-[48px]
    ${error ? 'border-red-300' : 'border-[var(--portal-card-border)]'}`

  const labelEl = (
    <label htmlFor={id} className="block text-sm font-medium text-[var(--portal-text-primary)] mb-1.5">
      {question.label}
      {question.required && <span className="text-[var(--portal-error)] ml-0.5">*</span>}
    </label>
  )

  const descEl = question.description ? (
    <p className="text-xs text-[var(--portal-text-muted)] mb-2">{question.description}</p>
  ) : null

  const errorEl = error ? (
    <p className="text-[var(--portal-error)] text-xs mt-1">{error}</p>
  ) : null

  let input: React.ReactNode

  switch (question.type) {
    case 'text':
      input = (
        <>
          {labelEl}
          {descEl}
          <input
            id={id}
            type="text"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || undefined)}
            maxLength={question.max_length}
            className={inputBase}
          />
          {errorEl}
        </>
      )
      break

    case 'textarea':
      input = (
        <>
          {labelEl}
          {descEl}
          <textarea
            id={id}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || undefined)}
            maxLength={question.max_length}
            rows={4}
            className={`${inputBase} resize-y min-h-[100px]`}
          />
          <div className="flex justify-between items-center mt-0.5">
            {errorEl || <span />}
            {question.max_length && (
              <span className="text-xs text-[var(--portal-text-muted)]">
                {String(value ?? '').length}/{question.max_length}
              </span>
            )}
          </div>
        </>
      )
      break

    case 'number':
      input = (
        <>
          {labelEl}
          {descEl}
          <input
            id={id}
            type="number"
            value={value != null ? String(value) : ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
            className={inputBase}
          />
          {errorEl}
        </>
      )
      break

    case 'date':
      input = (
        <>
          {labelEl}
          {descEl}
          <input
            id={id}
            type="date"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={inputBase}
          />
          {errorEl}
        </>
      )
      break

    case 'url':
      input = (
        <>
          {labelEl}
          {descEl}
          <input
            id={id}
            type="url"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || undefined)}
            placeholder="https://"
            className={inputBase}
          />
          {errorEl}
        </>
      )
      break

    case 'select':
      input = (
        <>
          {labelEl}
          {descEl}
          <select
            id={id}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={inputBase}
          >
            <option value="">Select...</option>
            {(question.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {errorEl}
        </>
      )
      break

    case 'multi_select': {
      const selected = (Array.isArray(value) ? value : []) as string[]
      input = (
        <fieldset>
          <legend className="text-sm font-medium text-[var(--portal-text-primary)] mb-1.5">
            {question.label}
            {question.required && <span className="text-red-500 ml-0.5">*</span>}
          </legend>
          {descEl}
          <div className="space-y-2">
            {(question.options ?? []).map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2.5 text-sm text-[var(--portal-text-primary)] cursor-pointer min-h-[44px] px-1"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selected, opt])
                    } else {
                      onChange(selected.filter((s) => s !== opt))
                    }
                  }}
                  className="rounded border-[var(--portal-card-border)] w-4 h-4"
                  style={{ accentColor: 'var(--portal-primary)' }}
                />
                {opt}
              </label>
            ))}
          </div>
          {errorEl}
        </fieldset>
      )
      break
    }

    case 'scale': {
      const min = question.scale_min ?? 1
      const max = question.scale_max ?? 5
      const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      input = (
        <fieldset>
          <legend className="text-sm font-medium text-[var(--portal-text-primary)] mb-1.5">
            {question.label}
            {question.required && <span className="text-red-500 ml-0.5">*</span>}
          </legend>
          {descEl}
          <div className="flex gap-2 flex-wrap">
            {nums.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`w-11 h-11 rounded-md border text-sm font-medium transition-colors
                  ${
                    value === n
                      ? 'bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)] border-[var(--portal-primary)]'
                      : 'border-[var(--portal-card-border)] text-[var(--portal-text-secondary)] hover:bg-[var(--portal-bg)]'
                  }`}
                aria-pressed={value === n}
              >
                {n}
              </button>
            ))}
          </div>
          {errorEl}
        </fieldset>
      )
      break
    }

    case 'likert': {
      const labels = Array.isArray(question.scale_labels) ? question.scale_labels : LIKERT_LABELS_DEFAULT
      input = (
        <fieldset>
          <legend className="text-sm font-medium text-[var(--portal-text-primary)] mb-1.5">
            {question.label}
            {question.required && <span className="text-red-500 ml-0.5">*</span>}
          </legend>
          {descEl}
          <div className="flex flex-col sm:flex-row gap-2">
            {labels.map((label, i) => (
              <label
                key={i}
                className={`flex-1 text-center rounded-md border px-2 py-2 text-xs font-medium cursor-pointer transition-colors min-h-[44px] flex items-center justify-center
                  ${
                    value === label
                      ? 'border-[var(--portal-primary)] bg-[var(--portal-primary)]/10 text-[var(--portal-primary)]'
                      : 'border-[var(--portal-card-border)] text-[var(--portal-text-secondary)] hover:bg-[var(--portal-bg)]'
                  }`}
              >
                <input
                  type="radio"
                  name={`likert-${question.id}`}
                  value={label}
                  checked={value === label}
                  onChange={() => onChange(label)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          {errorEl}
        </fieldset>
      )
      break
    }

    case 'emoji': {
      input = (
        <fieldset>
          <legend className="text-sm font-medium text-[var(--portal-text-primary)] mb-1.5">
            {question.label}
            {question.required && <span className="text-red-500 ml-0.5">*</span>}
          </legend>
          {descEl}
          <div className="flex gap-3">
            {EMOJI_CHARS.map((emoji, i) => (
              <button
                key={EMOJI_OPTIONS[i]}
                type="button"
                onClick={() => onChange(EMOJI_OPTIONS[i])}
                className={`w-12 h-12 rounded-lg border text-2xl transition-all
                  ${
                    value === EMOJI_OPTIONS[i]
                      ? 'border-[var(--portal-primary)] bg-[var(--portal-primary)]/10 scale-110'
                      : 'border-[var(--portal-card-border)] hover:bg-[var(--portal-bg)]'
                  }`}
                aria-pressed={value === EMOJI_OPTIONS[i]}
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
          {errorEl}
        </fieldset>
      )
      break
    }

    case 'yes_no': {
      input = (
        <fieldset>
          <legend className="text-sm font-medium text-[var(--portal-text-primary)] mb-1.5">
            {question.label}
            {question.required && <span className="text-red-500 ml-0.5">*</span>}
          </legend>
          {descEl}
          <div className="flex gap-3">
            {['yes', 'no'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={`flex-1 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors min-h-[48px]
                  ${
                    value === option
                      ? 'border-[var(--portal-primary)] bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)]'
                      : 'border-[var(--portal-card-border)] text-[var(--portal-text-secondary)] hover:bg-[var(--portal-bg)]'
                  }`}
                aria-pressed={value === option}
              >
                {option === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
          {errorEl}
        </fieldset>
      )
      break
    }

    case 'file_upload':
      input = (
        <>
          {labelEl}
          {descEl}
          <label
            htmlFor={id}
            className={`block rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors
              ${
                value
                  ? 'border-[var(--portal-primary)]/40 bg-[var(--portal-primary)]/5'
                  : 'border-[var(--portal-card-border)] hover:border-[var(--portal-card-border-hover)]'
              }`}
          >
            <p className="text-sm text-[var(--portal-text-secondary)]">
              {value ? String(value) : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-[var(--portal-text-muted)] mt-1">
              File upload will be available in a future update
            </p>
            <input
              id={id}
              type="file"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onChange(file.name)
              }}
            />
          </label>
          {errorEl}
        </>
      )
      break

    default:
      input = (
        <>
          {labelEl}
          {descEl}
          <input
            id={id}
            type="text"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={inputBase}
          />
          {errorEl}
        </>
      )
  }

  return (
    <div className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] bg-[var(--portal-card-bg)] p-4 sm:p-5
      focus-within:ring-2 focus-within:ring-[var(--portal-primary)]/20 transition-shadow duration-[var(--portal-transition)]">
      {input}
    </div>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────

function FormSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-[var(--portal-radius)] border border-[var(--portal-card-border)] p-5">
          <div className="h-4 w-32 rounded portal-shimmer mb-3" />
          <div className="h-10 w-full rounded portal-shimmer" />
        </div>
      ))}
    </div>
  )
}
