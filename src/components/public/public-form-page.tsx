'use client'

import { useState, useCallback, useMemo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { ClickToSign } from './click-to-sign'

interface FormFieldDef {
  type: string
  name: string
  label: string
  required?: boolean
  options?: string[]
  max_length?: number
  description?: string
}

interface PublicFormPageProps {
  link: {
    id: string
    token: string
    shareType: string
    formSchema: Record<string, unknown> | null
    blockId: string
    orgId: string
  }
  block: {
    id: string
    name: string
    type: string
  }
  branding: {
    companyName: string
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string | null
    fontFamily: string | null
  }
  documentHash?: string
}

export function PublicFormPage({ link, block, branding, documentHash }: PublicFormPageProps) {
  const schema = link.formSchema as {
    title?: string
    description?: string
    fields?: FormFieldDef[]
    collect_contact?: boolean
  } | null

  const fields = useMemo(() => schema?.fields ?? [], [schema?.fields])
  const collectContact = schema?.collect_contact !== false

  const [values, setValues] = useState<Record<string, unknown>>({})
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const validate = useCallback(() => {
    const errors: Record<string, string> = {}
    for (const field of fields) {
      if (field.required) {
        const val = values[field.name]
        if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) {
          errors[field.name] = `${field.label} is required`
        }
      }
      if (field.max_length) {
        const val = values[field.name]
        if (typeof val === 'string' && val.length > field.max_length) {
          errors[field.name] = `${field.label} must be ${field.max_length} characters or less`
        }
      }
    }
    if (collectContact && contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      errors['_email'] = 'Please enter a valid email address'
    }
    return errors
  }, [fields, values, collectContact, contactEmail])

  const handleSubmit = useCallback(async () => {
    const errors = validate()
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/public/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: link.token,
          field_data: values,
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
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [link.token, values, contactName, contactEmail, validate])

  const handleFieldChange = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setValidationErrors((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  // View-only mode
  if (link.shareType === 'view') {
    return (
      <PublicShell branding={branding}>
        <h1 className="text-xl font-semibold text-foreground mb-2">{block.name}</h1>
        <p className="text-muted-foreground text-sm">
          This is a view-only link. No actions available.
        </p>
      </PublicShell>
    )
  }

  // Sign mode — click-to-sign flow
  if (link.shareType === 'sign' && documentHash) {
    return (
      <PublicShell branding={branding}>
        <ClickToSign
          token={link.token}
          documentHash={documentHash}
          documentName={block.name}
          branding={{ companyName: branding.companyName, primaryColor: branding.primaryColor }}
        />
      </PublicShell>
    )
  }

  // Submitted state
  if (submitted) {
    return (
      <PublicShell branding={branding}>
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: branding.primaryColor }} />
          <h1 className="text-xl font-semibold text-foreground mb-2">Submitted Successfully</h1>
          <p className="text-muted-foreground text-sm">
            Thank you for your response. You can close this page.
          </p>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell branding={branding}>
      <h1 className="text-xl font-semibold text-foreground mb-1">
        {schema?.title ?? block.name}
      </h1>
      {schema?.description && (
        <p className="text-muted-foreground text-sm mb-6">{schema.description}</p>
      )}

      <div className="space-y-4">
        {/* Contact info */}
        {collectContact && (
          <div className="space-y-3 pb-4 border-b border-border">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-muted-foreground mb-1">
                Your Name
              </label>
              <input
                id="contact-name"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Full name"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium text-muted-foreground mb-1">
                Email Address
              </label>
              <input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value)
                  setValidationErrors((prev) => {
                    const next = { ...prev }
                    delete next['_email']
                    return next
                  })
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="your@email.com"
              />
              {validationErrors['_email'] && (
                <p className="text-destructive text-xs mt-1">{validationErrors['_email']}</p>
              )}
            </div>
          </div>
        )}

        {/* Dynamic form fields */}
        {fields.map((field) => (
          <FormField
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(v) => handleFieldChange(field.name, v)}
            error={validationErrors[field.name]}
            primaryColor={branding.primaryColor}
          />
        ))}

        {/* Error message */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: branding.primaryColor }}
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </PublicShell>
  )
}

/** Minimal branded shell for public pages */
function PublicShell({
  branding,
  children,
}: {
  branding: PublicFormPageProps['branding']
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {branding.logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={branding.logoUrl}
              alt={branding.companyName}
              className="h-8 w-auto"
            />
          )}
          <span className="text-sm font-semibold text-foreground">
            {branding.companyName}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto bg-card border border-border rounded-xl p-6 shadow-sm">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3">
        <p className="text-center text-xs text-muted-foreground">
          Powered by Ops OS
        </p>
      </footer>
    </div>
  )
}

/** Renders a single form field based on its type */
function FormField({
  field,
  value,
  onChange,
  error,
  primaryColor,
}: {
  field: FormFieldDef
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  primaryColor: string
}) {
  const id = `field-${field.name}`
  const inputClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  const label = (
    <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1">
      {field.label}
      {field.required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )

  let input: React.ReactNode

  switch (field.type) {
    case 'textarea':
      input = (
        <textarea
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          maxLength={field.max_length}
          rows={3}
          className={inputClass}
          placeholder={field.description}
        />
      )
      break

    case 'select':
      input = (
        <select
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={inputClass}
        >
          <option value="">Select...</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
      break

    case 'number':
      input = (
        <input
          id={id}
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className={inputClass}
        />
      )
      break

    case 'date':
      input = (
        <input
          id={id}
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={inputClass}
        />
      )
      break

    case 'checkbox':
      input = (
        <label htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-input"
            style={{ accentColor: primaryColor }}
          />
          <span className="text-foreground">{field.label}</span>
        </label>
      )
      return (
        <div>
          {input}
          {error && <p className="text-destructive text-xs mt-1">{error}</p>}
        </div>
      )

    default: // text
      input = (
        <input
          id={id}
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
          maxLength={field.max_length}
          className={inputClass}
          placeholder={field.description}
        />
      )
  }

  return (
    <div>
      {label}
      {input}
      {field.max_length && typeof value === 'string' && (
        <p className="text-xs text-muted-foreground mt-0.5 text-right">
          {value.length}/{field.max_length}
        </p>
      )}
      {error && <p className="text-destructive text-xs mt-1">{error}</p>}
    </div>
  )
}
