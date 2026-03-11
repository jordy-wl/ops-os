'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Chrome,
  Webhook,
  Globe,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  Key,
  Link2,
} from 'lucide-react'

type Provider = 'google' | 'webhook' | 'custom_api'
type Step = 'select' | 'configure' | 'test' | 'complete'

const STEPS: { key: Step; label: string }[] = [
  { key: 'select', label: 'Provider' },
  { key: 'configure', label: 'Configure' },
  { key: 'test', label: 'Test' },
  { key: 'complete', label: 'Complete' },
]

const PROVIDERS: { value: Provider; label: string; description: string; icon: typeof Chrome }[] = [
  { value: 'google', label: 'Google Workspace', description: 'Gmail, Calendar, and Drive', icon: Chrome },
  { value: 'webhook', label: 'Webhook', description: 'Receive data via HTTP POST', icon: Webhook },
  { value: 'custom_api', label: 'Custom API', description: 'Connect to any REST API', icon: Globe },
]

interface OnboardingWizardProps {
  initialProvider?: Provider
}

export function OnboardingWizard({ initialProvider }: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(initialProvider ? 'configure' : 'select')
  const [provider, setProvider] = useState<Provider | null>(initialProvider ?? null)
  const [connectorName, setConnectorName] = useState('')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [connectorId, setConnectorId] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  const [hmacSecret, setHmacSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  function handleProviderSelect(p: Provider) {
    setProvider(p)
    setConnectorName('')
    setConfig({})
    setStep('configure')
  }

  function handleBack() {
    if (step === 'configure') setStep('select')
    else if (step === 'test') setStep('configure')
  }

  const handleCreateAndTest = useCallback(async () => {
    if (!provider || !connectorName.trim()) return
    setCreating(true)
    setTestStatus('testing')
    setTestError(null)

    try {
      // For Google, redirect to OAuth
      if (provider === 'google') {
        window.location.href = '/api/auth/google'
        return
      }

      // Create the connector
      const direction = provider === 'webhook' ? 'inbound' : 'outbound'
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: connectorName.trim(),
          provider,
          direction,
          config:
            provider === 'custom_api'
              ? { endpoint: config.endpoint, api_key: config.api_key }
              : undefined,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setTestStatus('error')
        setTestError(json?.error?.message ?? 'Failed to create connector')
        return
      }

      setConnectorId(json.data?.id ?? null)
      if (json.data?.webhook_url) {
        setWebhookUrl(`${window.location.origin}${json.data.webhook_url}`)
      }
      if (json.data?.hmac_secret) {
        setHmacSecret(json.data.hmac_secret)
      }

      // Test the connection (for custom API)
      if (provider === 'custom_api' && json.data?.id) {
        const testRes = await fetch(`/api/integrations/${json.data.id}/test`, { method: 'POST' })
        if (testRes.ok) {
          setTestStatus('success')
        } else {
          setTestStatus('error')
          setTestError('Connection test failed — check your endpoint and API key')
        }
      } else {
        // Webhook always succeeds on creation
        setTestStatus('success')
      }

      setStep('test')
    } catch {
      setTestStatus('error')
      setTestError('Network error — please try again')
    } finally {
      setCreating(false)
    }
  }, [provider, connectorName, config])

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const canProceedConfigure =
    connectorName.trim().length > 0 &&
    (provider === 'google' ||
      provider === 'webhook' ||
      (provider === 'custom_api' && (config.endpoint ?? '').trim().length > 0))

  return (
    <div className="mx-auto max-w-xl">
      {/* Step indicator */}
      <nav aria-label="Wizard progress" className="mb-8">
        <ol className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  i < stepIndex && 'bg-gray-900 text-white',
                  i === stepIndex && 'bg-gray-900 text-white ring-2 ring-gray-900 ring-offset-2',
                  i > stepIndex && 'bg-gray-100 text-gray-400'
                )}
              >
                {i < stepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'hidden sm:block text-sm',
                  i <= stepIndex ? 'text-gray-900 font-medium' : 'text-gray-400'
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={cn('flex-1 h-px', i < stepIndex ? 'bg-gray-900' : 'bg-gray-200')}
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Step 1: Provider Selection */}
      {step === 'select' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Choose a provider</h2>
          <p className="text-sm text-gray-500 mb-6">
            Select the type of integration you want to connect.
          </p>
          <div className="grid gap-3">
            {PROVIDERS.map((p) => {
              const Icon = p.icon
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleProviderSelect(p.value)}
                  className={cn(
                    'flex items-center gap-4 rounded-lg border border-gray-200 p-4 text-left transition-all',
                    'hover:border-gray-400 hover:shadow-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Icon className="h-5 w-5 text-gray-600" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.label}</p>
                    <p className="text-xs text-gray-500">{p.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 'configure' && provider && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Configure {PROVIDERS.find((p) => p.value === provider)?.label}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {provider === 'google' &&
              'You will be redirected to Google to authorize access.'}
            {provider === 'webhook' &&
              'We will generate a unique webhook URL for receiving data.'}
            {provider === 'custom_api' &&
              'Provide the API endpoint and credentials.'}
          </p>

          <label
            htmlFor="connector-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Connector Name
          </label>
          <input
            id="connector-name"
            type="text"
            value={connectorName}
            onChange={(e) => setConnectorName(e.target.value)}
            placeholder="e.g. Production CRM"
            maxLength={255}
            className="mb-4 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />

          {provider === 'custom_api' && (
            <>
              <label
                htmlFor="api-endpoint"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                API Endpoint
              </label>
              <div className="relative mb-4">
                <Link2
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  id="api-endpoint"
                  type="url"
                  value={config.endpoint ?? ''}
                  onChange={(e) => setConfig((c) => ({ ...c, endpoint: e.target.value }))}
                  placeholder="https://api.example.com/webhook"
                  className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <label
                htmlFor="api-key"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                API Key <span className="text-gray-400">(optional)</span>
              </label>
              <div className="relative mb-4">
                <Key
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  id="api-key"
                  type="password"
                  value={config.api_key ?? ''}
                  onChange={(e) => setConfig((c) => ({ ...c, api_key: e.target.value }))}
                  placeholder="sk-..."
                  className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={handleBack}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium',
                'border border-gray-200 text-gray-700 hover:bg-gray-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
              )}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
            <button
              type="button"
              onClick={handleCreateAndTest}
              disabled={!canProceedConfigure || creating}
              className={cn(
                'ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium',
                'bg-gray-900 text-white hover:bg-gray-700',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {provider === 'google' ? 'Redirecting...' : 'Creating...'}
                </>
              ) : (
                <>
                  {provider === 'google' ? 'Connect with Google' : 'Create & Test'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Test Connection */}
      {step === 'test' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Connection Test</h2>
          <p className="text-sm text-gray-500 mb-6">
            Verifying your integration is set up correctly.
          </p>

          <div
            className={cn(
              'rounded-lg border p-6 text-center',
              testStatus === 'success' && 'border-green-200 bg-green-50',
              testStatus === 'error' && 'border-red-200 bg-red-50',
              (testStatus === 'idle' || testStatus === 'testing') && 'border-gray-200 bg-gray-50'
            )}
          >
            {testStatus === 'testing' && (
              <>
                <Loader2
                  className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-3"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-gray-700" role="status">
                  Testing connection...
                </p>
              </>
            )}
            {testStatus === 'success' && (
              <>
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm font-medium text-green-800" role="status">
                  Connection successful!
                </p>
              </>
            )}
            {testStatus === 'error' && (
              <>
                <XCircle className="h-8 w-8 text-red-600 mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm font-medium text-red-800" role="alert">
                  Connection failed
                </p>
                {testError && <p className="text-xs text-red-600 mt-1">{testError}</p>}
              </>
            )}
          </div>

          {/* Show webhook URL and HMAC secret for webhook provider */}
          {provider === 'webhook' && webhookUrl && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-xs font-mono bg-gray-50"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookUrl, 'url')}
                    aria-label="Copy webhook URL"
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                  >
                    {copied === 'url' ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {copied === 'url' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              {hmacSecret && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    HMAC Secret
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={hmacSecret}
                      className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-xs font-mono bg-gray-50"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(hmacSecret, 'secret')}
                      aria-label="Copy HMAC secret"
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                    >
                      {copied === 'secret' ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {copied === 'secret' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => setStep('configure')}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium',
                'border border-gray-200 text-gray-700 hover:bg-gray-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
              )}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
            {testStatus === 'success' && (
              <button
                type="button"
                onClick={() => setStep('complete')}
                className={cn(
                  'ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium',
                  'bg-gray-900 text-white hover:bg-gray-700',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
                )}
              >
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {testStatus === 'error' && (
              <button
                type="button"
                onClick={handleCreateAndTest}
                disabled={creating}
                className={cn(
                  'ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium',
                  'bg-gray-900 text-white hover:bg-gray-700',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && (
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Integration Connected!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your {PROVIDERS.find((p) => p.value === provider)?.label} integration is ready to use.
          </p>
          <button
            type="button"
            onClick={() => router.push('/integrations')}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium',
              'bg-gray-900 text-white hover:bg-gray-700',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
            )}
          >
            View Integrations
          </button>
        </div>
      )}
    </div>
  )
}
