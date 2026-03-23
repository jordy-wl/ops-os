'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { usePortal } from '@/components/portal/portal-context'
import {
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Upload,
} from 'lucide-react'
import {
  type BranchingConfig,
  type FormQuestion,
  evaluateBranching,
  LIKERT_LABELS_DEFAULT,
} from '@/lib/form-types'

// --- Types ---

interface FormTemplate {
  id: string
  title: string
  description?: string
  questions: FormQuestion[]
  collect_contact?: boolean
}

// --- Constants ---

const EMOJI_OPTIONS = ['1f600', '1f610', '1f641', '1f622', '1f621']
const EMOJI_CHARS = ['😀', '😐', '🙁', '😢', '😡']

// --- Main component ---

export default function PortalFormPage() {
  const { token } = usePortal()
  const params = useParams()
  const formId = params.formId as string

  const [form, setForm] = useState<FormTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchForm() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/portal/${token}/forms/${formId}`)
        if (!res.ok) {
          throw new Error('Form not found')
        }

        const data = await res.json()

        if (!cancelled) {
          const formData = data.data ?? data
          setForm(formData)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError('Could not load this form. It may no longer be available.')
          setLoading(false)
        }
      }
    }

    fetchForm()

    return () => {
      cancelled = true
    }
  }, [token, formId])

  // Determine visible questions based on branching
  const visibleQuestions = useMemo(() => {
    if (!form) return []
    return form.questions.filter((q) => {
      if (!q.branching) return true
      return evaluateBranching(q.branching, answers)
    })
  }, [form, answers])

  // Progress calculation
  const answeredCount = useMemo(() => {
    return visibleQuestions.filter((q) => {
      const val = answers[q.id]
      if (val == null || val === '') return false
      if (Array.isArray(val) && val.length === 0) return false
      return true
    }).length
  }, [visibleQuestions, answers])

  const totalQuestions = visibleQuestions.length
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0

  const setAnswer = useCallback((questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    setValidationErrors((prev) => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
  }, [])

  const validate = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {}

    for (const q of visibleQuestions) {
      if (q.required) {
        const val = answers[q.id]
        if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) {
          errors[q.id] = `${q.label} is required`
        }
      }

      if (q.type === 'url' && answers[q.id]) {
        const urlVal = String(answers[q.id])
        if (urlVal && !/^https?:\/\/.+/.test(urlVal)) {
          errors[q.id] = 'Please enter a valid URL starting with http:// or https://'
        }
      }

      if (q.max_length && typeof answers[q.id] === 'string') {
        if ((answers[q.id] as string).length > q.max_length) {
          errors[q.id] = `Must be ${q.max_length} characters or less`
        }
      }
    }

    if (form?.collect_contact) {
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        errors['_contact_email'] = 'Please enter a valid email address'
      }
    }

    return errors
  }, [visibleQuestions, answers, form, contactEmail])

  const handleSubmit = useCallback(async () => {
    const errors = validate()
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/portal/${token}/forms/${formId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          respondent_name: contactName || undefined,
          respondent_email: contactEmail || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'Submission failed')
      }

      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [token, formId, answers, contactName, contactEmail, validate])

  // --- Render states ---

  if (loading) {
    return <FormSkeleton />
  }

  if (error || !form) {
    return (
      <div className="text-center py-12 max-w-xl mx-auto">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
        <p className="text-sm text-gray-600 mb-4">{error || 'Form not found'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
            bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)]
            hover:opacity-90 transition-opacity min-h-[44px]"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <CheckCircle2
          className="w-12 h-12 mx-auto mb-4"
          style={{ color: 'var(--portal-primary)' }}
        />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Form Submitted
        </h1>
        <p className="text-sm text-gray-500">
          Thank you for completing this form. Your responses have been recorded.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-24 sm:pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
          {form.title}
        </h1>
        {form.description && (
          <p className="text-sm text-gray-500 mt-1">{form.description}</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>{answeredCount} of {totalQuestions} answered</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: 'var(--portal-primary)',
            }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${answeredCount} of ${totalQuestions} questions answered`}
          />
        </div>
      </div>

      {/* Contact info */}
      {form.collect_contact && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 mb-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Your Information</p>
          <div>
            <label htmlFor="contact-name" className="block text-xs font-medium text-gray-500 mb-1">
              Name
            </label>
            <input
              id="contact-name"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
                min-h-[48px]"
            />
          </div>
          <div>
            <label htmlFor="contact-email" className="block text-xs font-medium text-gray-500 mb-1">
              Email
            </label>
            <input
              id="contact-email"
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
                ${validationErrors['_contact_email'] ? 'border-red-300' : 'border-gray-300'}`}
            />
            {validationErrors['_contact_email'] && (
              <p className="text-red-500 text-xs mt-1">{validationErrors['_contact_email']}</p>
            )}
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {form.questions.map((question) => {
          const isVisible = !question.branching || evaluateBranching(question.branching, answers)

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
                  value={answers[question.id]}
                  onChange={(val) => setAnswer(question.id, val)}
                  error={validationErrors[question.id]}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {submitError}
        </div>
      )}

      {/* Desktop submit */}
      <div className="hidden sm:block mt-6">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-md px-4 py-2.5 text-sm font-medium
            bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)]
            hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>

      {/* Mobile sticky submit bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-20">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-md px-4 py-3 text-sm font-medium
            bg-[var(--portal-primary)] text-[var(--portal-primary-foreground)]
            hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}

// --- Question Field Component ---

interface QuestionFieldProps {
  question: FormQuestion
  value: unknown
  onChange: (value: unknown) => void
  error?: string
}

function QuestionField({ question, value, onChange, error }: QuestionFieldProps) {
  const id = `q-${question.id}`

  const inputBase = `w-full rounded-md border px-3 py-2.5 text-sm
    focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary)]/30 focus:border-[var(--portal-primary)]
    min-h-[48px]
    ${error ? 'border-red-300' : 'border-gray-300'}`

  const labelEl = (
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
      {question.label}
      {question.required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )

  const descEl = question.description ? (
    <p className="text-xs text-gray-400 mb-2">{question.description}</p>
  ) : null

  const errorEl = error ? (
    <p className="text-red-500 text-xs mt-1">{error}</p>
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
              <span className="text-xs text-gray-400">
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
          <legend className="text-sm font-medium text-gray-700 mb-1.5">
            {question.label}
            {question.required && <span className="text-red-500 ml-0.5">*</span>}
          </legend>
          {descEl}
          <div className="space-y-2">
            {(question.options ?? []).map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer min-h-[44px] px-1"
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
                  className="rounded border-gray-300 w-4 h-4"
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
          <legend className="text-sm font-medium text-gray-700 mb-1.5">
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
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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
          <legend className="text-sm font-medium text-gray-700 mb-1.5">
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
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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
          <legend className="text-sm font-medium text-gray-700 mb-1.5">
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
                      : 'border-gray-200 hover:bg-gray-50'
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
          <legend className="text-sm font-medium text-gray-700 mb-1.5">
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
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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
                  : 'border-gray-300 hover:border-gray-400'
              }`}
          >
            <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" aria-hidden="true" />
            <p className="text-sm text-gray-600">
              {value ? String(value) : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              File upload will be available in a future update
            </p>
            <input
              id={id}
              type="file"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  onChange(file.name)
                }
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
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      {input}
    </div>
  )
}

// --- Skeleton ---

function FormSkeleton() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse">
      <div className="h-7 w-64 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-48 bg-gray-100 rounded mb-6" />

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between mb-1.5">
          <div className="h-3 w-24 bg-gray-100 rounded" />
          <div className="h-3 w-8 bg-gray-100 rounded" />
        </div>
        <div className="h-2 w-full bg-gray-100 rounded-full" />
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-5">
            <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
            <div className="h-10 w-full bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
