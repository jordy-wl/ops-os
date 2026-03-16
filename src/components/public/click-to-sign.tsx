'use client'

import { useState, useCallback } from 'react'
import { CheckCircle2, ShieldCheck, FileSignature } from 'lucide-react'

interface ClickToSignProps {
  token: string
  documentHash: string
  documentName: string
  branding: {
    companyName: string
    primaryColor: string
  }
}

type SignStep = 'review' | 'consent' | 'signed' | 'declined'

const CONSENT_TEXT = 'By clicking "I Agree & Sign", I confirm that I have reviewed the document and agree to be legally bound by its terms. I understand this constitutes an electronic signature under applicable law.'

export function ClickToSign({ token, documentHash, documentName, branding }: ClickToSignProps) {
  const [step, setStep] = useState<SignStep>('review')
  const [signerName, setSignerName] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recordEvent = useCallback(async (
    eventType: 'viewed' | 'consented' | 'signed' | 'declined',
    extra?: { consent_text?: string }
  ) => {
    try {
      const res = await fetch('/api/public/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          event_type: eventType,
          document_hash_sha256: documentHash,
          signer_name: signerName || undefined,
          signer_email: signerEmail || undefined,
          ...extra,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'Failed to record signature')
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      return false
    }
  }, [token, documentHash, signerName, signerEmail])

  const handleReviewed = useCallback(async () => {
    setSubmitting(true)
    await recordEvent('viewed')
    setStep('consent')
    setSubmitting(false)
  }, [recordEvent])

  const handleSign = useCallback(async () => {
    if (!signerName.trim()) {
      setError('Please enter your full name')
      return
    }
    setSubmitting(true)
    setError(null)

    const consentOk = await recordEvent('consented', { consent_text: CONSENT_TEXT })
    if (!consentOk) { setSubmitting(false); return }

    const signOk = await recordEvent('signed')
    if (signOk) setStep('signed')
    setSubmitting(false)
  }, [recordEvent, signerName])

  const handleDecline = useCallback(async () => {
    setSubmitting(true)
    const ok = await recordEvent('declined')
    if (ok) setStep('declined')
    setSubmitting(false)
  }, [recordEvent])

  // Signed confirmation
  if (step === 'signed') {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-600" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Document Signed</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Your signature has been recorded with a full audit trail.
        </p>
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          SHA-256: {documentHash.substring(0, 12)}...
        </div>
      </div>
    )
  }

  // Declined
  if (step === 'declined') {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-foreground mb-2">Signature Declined</h2>
        <p className="text-muted-foreground text-sm">
          You have declined to sign this document. The sender has been notified.
        </p>
      </div>
    )
  }

  // Review step
  if (step === 'review') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <FileSignature className="w-5 h-5" style={{ color: branding.primaryColor }} />
          <h2 className="text-lg font-semibold text-foreground">Document for Signature</h2>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">{documentName}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Please review this document before signing.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleReviewed}
          disabled={submitting}
          className="w-full rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: branding.primaryColor }}
        >
          {submitting ? 'Loading...' : 'I Have Reviewed This Document'}
        </button>
      </div>
    )
  }

  // Consent + sign step
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileSignature className="w-5 h-5" style={{ color: branding.primaryColor }} />
        <h2 className="text-lg font-semibold text-foreground">Sign Document</h2>
      </div>

      {/* Consent text */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{CONSENT_TEXT}</p>
      </div>

      {/* Signer info */}
      <div className="space-y-3">
        <div>
          <label htmlFor="signer-name" className="block text-sm font-medium text-muted-foreground mb-1">
            Full Legal Name <span className="text-destructive">*</span>
          </label>
          <input
            id="signer-name"
            type="text"
            value={signerName}
            onChange={(e) => { setSignerName(e.target.value); setError(null) }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Your full legal name"
          />
        </div>
        <div>
          <label htmlFor="signer-email" className="block text-sm font-medium text-muted-foreground mb-1">
            Email Address
          </label>
          <input
            id="signer-email"
            type="email"
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="your@email.com"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDecline}
          disabled={submitting}
          className="flex-1 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={handleSign}
          disabled={submitting}
          className="flex-1 rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: branding.primaryColor }}
        >
          {submitting ? 'Signing...' : 'I Agree & Sign'}
        </button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Your signature, IP address, and timestamp will be recorded as part of the audit trail.
      </p>
    </div>
  )
}
