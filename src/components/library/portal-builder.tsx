'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Search,
  Check,
  Globe,
  ClipboardList,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronRight,
  GitBranch,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  PORTAL_FEATURE_FLAGS,
  ALL_PORTAL_BLOCK_TYPES,
} from '@/lib/portal-constants'
import type { ExposedBlockTypeConfig } from '@/lib/portal-constants'
import { SYSTEM_BLOCK_TYPES } from '@/lib/block-types/system-types'

interface FormTemplateSummary {
  id: string
  name: string
  questionCount: number
  status: string
}

interface ClientOption {
  id: string
  name: string
}

interface WorkflowTemplateSummary {
  id: string
  name: string
  description: string
}

interface RequestTypeConfigItem {
  workflow_template_id: string
  form_template_id?: string
  display_name?: string
}

interface PortalBuilderProps {
  formTemplates: FormTemplateSummary[]
  clients: ClientOption[]
  workflowTemplates: WorkflowTemplateSummary[]
}

/** Look up a system block type definition by type_name */
function getSystemType(typeName: string) {
  return SYSTEM_BLOCK_TYPES.find((t) => t.type_name === typeName)
}

/** Extract field entries from a type's field_schema, sorted by x-display-order */
function getFieldEntries(typeName: string): { key: string; label: string; order: number }[] {
  const def = getSystemType(typeName)
  if (!def?.field_schema?.properties) return []

  const props = def.field_schema.properties as Record<
    string,
    { description?: string; 'x-display-order'?: number }
  >

  return Object.entries(props)
    .map(([key, schema]) => ({
      key,
      label: schema.description ?? formatFieldKey(key),
      order: schema['x-display-order'] ?? 999,
    }))
    .sort((a, b) => a.order - b.order)
}

/** Convert snake_case to Title Case for display */
function formatFieldKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function PortalBuilder({ formTemplates, clients, workflowTemplates }: PortalBuilderProps) {
  const router = useRouter()

  // Portal config state
  const [name, setName] = useState('')
  const [dashboardEnabled, setDashboardEnabled] = useState(true)
  const [documentsEnabled, setDocumentsEnabled] = useState(true)
  const [requestsEnabled, setRequestsEnabled] = useState(true)
  const [formsEnabled, setFormsEnabled] = useState(true)
  const [exposedBlockTypeConfig, setExposedBlockTypeConfig] = useState<ExposedBlockTypeConfig>({})
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())
  const [selectedFormTemplateIds, setSelectedFormTemplateIds] = useState<string[]>([])

  // Request type config state
  const [requestTypeConfig, setRequestTypeConfig] = useState<RequestTypeConfigItem[]>([])

  // Branding
  const [displayName, setDisplayName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#2563eb')

  // Client assignment
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')

  // Submission
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const featureState: Record<string, boolean> = {
    dashboard_enabled: dashboardEnabled,
    documents_enabled: documentsEnabled,
    requests_enabled: requestsEnabled,
    forms_enabled: formsEnabled,
  }

  const featureSetters: Record<string, (v: boolean) => void> = {
    dashboard_enabled: setDashboardEnabled,
    documents_enabled: setDocumentsEnabled,
    requests_enabled: setRequestsEnabled,
    forms_enabled: setFormsEnabled,
  }

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients
    const q = clientSearch.toLowerCase()
    return clients.filter((c) => c.name.toLowerCase().includes(q))
  }, [clients, clientSearch])

  // Derive the legacy exposed_block_types array from the config
  const exposedBlockTypes = useMemo(
    () =>
      Object.entries(exposedBlockTypeConfig)
        .filter(([, v]) => v.enabled)
        .map(([k]) => k),
    [exposedBlockTypeConfig]
  )

  const handleTypeToggle = (typeName: string, enabled: boolean) => {
    setExposedBlockTypeConfig((prev) => ({
      ...prev,
      [typeName]: { enabled, fields: prev[typeName]?.fields ?? {} },
    }))
  }

  const handleFieldToggle = (typeName: string, fieldKey: string, visible: boolean) => {
    setExposedBlockTypeConfig((prev) => {
      const current = prev[typeName] ?? { enabled: true, fields: {} }
      return {
        ...prev,
        [typeName]: { ...current, fields: { ...current.fields, [fieldKey]: visible } },
      }
    })
  }

  const toggleExpanded = (typeName: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(typeName)) {
        next.delete(typeName)
      } else {
        next.add(typeName)
      }
      return next
    })
  }

  const handleFormToggle = (id: string, checked: boolean) => {
    setSelectedFormTemplateIds((prev) =>
      checked ? [...prev, id] : prev.filter((fid) => fid !== id)
    )
  }

  const handleRequestTypeToggle = (workflowId: string, checked: boolean) => {
    setRequestTypeConfig((prev) => {
      if (checked) {
        return [...prev, { workflow_template_id: workflowId }]
      }
      return prev.filter((rt) => rt.workflow_template_id !== workflowId)
    })
  }

  const handleRequestTypeFormTemplate = (workflowId: string, formTemplateId: string) => {
    setRequestTypeConfig((prev) =>
      prev.map((rt) =>
        rt.workflow_template_id === workflowId
          ? { ...rt, form_template_id: formTemplateId || undefined }
          : rt
      )
    )
  }

  const handleRequestTypeDisplayName = (workflowId: string, displayNameValue: string) => {
    setRequestTypeConfig((prev) =>
      prev.map((rt) =>
        rt.workflow_template_id === workflowId
          ? { ...rt, display_name: displayNameValue || undefined }
          : rt
      )
    )
  }

  const handleSubmit = async (asTemplate: boolean) => {
    if (!name.trim()) {
      setError('Portal name is required')
      return
    }
    if (!asTemplate && !selectedClientId) {
      setError('Select a client or save as template')
      return
    }

    setCreating(true)
    setError(null)

    const brandingOverrides: Record<string, unknown> = {}
    if (displayName.trim()) brandingOverrides.display_name = displayName.trim()
    if (logoUrl.trim()) brandingOverrides.logo_url = logoUrl.trim()
    if (primaryColor !== '#2563eb') brandingOverrides.primary_color = primaryColor

    try {
      const res = await fetch('/api/portal-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          client_block_id: asTemplate ? null : selectedClientId,
          is_template: asTemplate,
          dashboard_enabled: dashboardEnabled,
          documents_enabled: documentsEnabled,
          requests_enabled: requestsEnabled,
          forms_enabled: formsEnabled,
          exposed_block_types: exposedBlockTypes,
          exposed_block_type_config: Object.keys(exposedBlockTypeConfig).length > 0
            ? exposedBlockTypeConfig
            : {},
          branding_overrides: Object.keys(brandingOverrides).length > 0 ? brandingOverrides : null,
          form_template_ids: selectedFormTemplateIds.length > 0 ? selectedFormTemplateIds : null,
          request_type_config: requestTypeConfig.length > 0 ? requestTypeConfig : null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.message ?? `Failed to create portal (${res.status})`)
      }

      const data = await res.json()
      const config = data.data ?? data
      router.push(asTemplate ? '/library/portals' : `/library/portals/${config.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/library/portals"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Portals
      </Link>

      {/* Portal Name */}
      <div>
        <label
          htmlFor="portal-name"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          Portal Name
        </label>
        <input
          id="portal-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Standard Client Portal"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Features Card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Features</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Toggle which sections are available in the client portal.
        </p>
        <div className="space-y-3">
          {PORTAL_FEATURE_FLAGS.map((flag) => {
            const enabled = featureState[flag.key]
            return (
              <div
                key={flag.key}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{flag.label}</p>
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`Toggle ${flag.label}`}
                  onClick={() => featureSetters[flag.key](!enabled)}
                  className={`
                    relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
                    border-2 border-transparent shadow-sm transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                    ${enabled ? 'bg-primary' : 'bg-input'}
                  `}
                >
                  <span
                    className={`
                      pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform
                      ${enabled ? 'translate-x-5' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Visible Data Card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Visible Data</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Toggle which types of records clients can see, and configure field visibility per type.
        </p>
        <div className="rounded-lg border border-border divide-y divide-border">
          {ALL_PORTAL_BLOCK_TYPES.map((bt) => {
            const typeEnabled = exposedBlockTypeConfig[bt.value]?.enabled ?? false
            const isExpanded = expandedTypes.has(bt.value)
            const fields = getFieldEntries(bt.value)
            const fieldConfig = exposedBlockTypeConfig[bt.value]?.fields ?? {}

            return (
              <div key={bt.value}>
                {/* Type row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={typeEnabled}
                    aria-label={`Toggle ${bt.label}`}
                    onClick={() => handleTypeToggle(bt.value, !typeEnabled)}
                    className={`
                      relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
                      border-2 border-transparent shadow-sm transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                      ${typeEnabled ? 'bg-primary' : 'bg-input'}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform
                        ${typeEnabled ? 'translate-x-4' : 'translate-x-0'}
                      `}
                    />
                  </button>
                  <span className={`text-sm flex-1 ${typeEnabled ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {bt.label}
                  </span>
                  {typeEnabled && fields.length > 0 && (
                    <button
                      type="button"
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${bt.label} fields`}
                      onClick={() => toggleExpanded(bt.value)}
                      className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Field checkboxes */}
                {typeEnabled && isExpanded && fields.length > 0 && (
                  <div className="px-4 pb-3 pl-16">
                    <p className="text-xs text-muted-foreground mb-2">
                      Uncheck fields to hide them from the portal.
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {fields.map((field) => {
                        const hasExplicitConfig = Object.keys(fieldConfig).length > 0
                        const isVisible = hasExplicitConfig
                          ? fieldConfig[field.key] !== false
                          : true

                        return (
                          <label
                            key={field.key}
                            className="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={(e) => handleFieldToggle(bt.value, field.key, e.target.checked)}
                              className="rounded border-input w-3.5 h-3.5"
                            />
                            <span className="text-xs text-foreground">
                              {formatFieldKey(field.key)}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Forms Card (conditional) */}
      {formsEnabled && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Forms</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Select form templates to include in this portal.
          </p>

          {formTemplates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground mb-1">No form templates yet</p>
              <p className="text-xs text-muted-foreground">
                Create a form template block to make it available here.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {formTemplates.map((form) => {
                const checked = selectedFormTemplateIds.includes(form.id)
                return (
                  <label
                    key={form.id}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => handleFormToggle(form.id, e.target.checked)}
                        className="rounded border-input w-4 h-4 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{form.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {form.questionCount} question{form.questionCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={form.status === 'active' ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {form.status}
                      </Badge>
                      <Link href={`/blocks/${form.id}`} onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      </Link>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Request Types Card (conditional on requestsEnabled) */}
      {requestsEnabled && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Request Types</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Select workflow templates that clients can trigger as request types.
            When configured, clients see request type cards instead of the default form.
          </p>

          {workflowTemplates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <GitBranch className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground mb-1">No workflow templates yet</p>
              <p className="text-xs text-muted-foreground">
                Create a workflow template to make it available as a request type.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {workflowTemplates.map((wf) => {
                const isSelected = requestTypeConfig.some(
                  (rt) => rt.workflow_template_id === wf.id
                )
                const configItem = requestTypeConfig.find(
                  (rt) => rt.workflow_template_id === wf.id
                )

                return (
                  <div
                    key={wf.id}
                    className={`rounded-lg border transition-colors ${
                      isSelected ? 'border-primary/30 bg-primary/5' : 'border-border bg-background'
                    }`}
                  >
                    <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleRequestTypeToggle(wf.id, e.target.checked)}
                        className="rounded border-input w-4 h-4 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {wf.name}
                        </p>
                        {wf.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {wf.description}
                          </p>
                        )}
                      </div>
                    </label>

                    {/* Expanded config when selected */}
                    {isSelected && (
                      <div className="px-4 pb-3 pt-0 space-y-3 border-t border-border/50 mt-1 pt-3">
                        {/* Display name override */}
                        <div>
                          <label
                            htmlFor={`rt-display-${wf.id}`}
                            className="block text-xs font-medium text-muted-foreground mb-1"
                          >
                            Display Name
                            <span className="text-muted-foreground/60 font-normal ml-1">(optional)</span>
                          </label>
                          <input
                            id={`rt-display-${wf.id}`}
                            type="text"
                            value={configItem?.display_name ?? ''}
                            onChange={(e) =>
                              handleRequestTypeDisplayName(wf.id, e.target.value)
                            }
                            placeholder={wf.name}
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>

                        {/* Optional form template */}
                        <div>
                          <label
                            htmlFor={`rt-form-${wf.id}`}
                            className="block text-xs font-medium text-muted-foreground mb-1"
                          >
                            Intake Form
                            <span className="text-muted-foreground/60 font-normal ml-1">(optional)</span>
                          </label>
                          <select
                            id={`rt-form-${wf.id}`}
                            value={configItem?.form_template_id ?? ''}
                            onChange={(e) =>
                              handleRequestTypeFormTemplate(wf.id, e.target.value)
                            }
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">No intake form</option>
                            {formTemplates.map((ft) => (
                              <option key={ft.id} value={ft.id}>
                                {ft.name} ({ft.questionCount} questions)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Branding Card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Branding</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Customize the look of the client-facing portal.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="brand-display-name" className="block text-sm font-medium text-foreground mb-1.5">
              Display Name
            </label>
            <input
              id="brand-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Defaults to portal name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="brand-logo-url" className="block text-sm font-medium text-foreground mb-1.5">
              Logo URL
            </label>
            <input
              id="brand-logo-url"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="brand-primary-color" className="block text-sm font-medium text-foreground mb-1.5">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="brand-primary-color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-14 rounded-md border border-input cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Preview</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: primaryColor }}>
                {logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-6 w-auto"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <Globe className="w-5 h-5 text-white" />
                )}
                <span className="text-sm font-semibold text-white">
                  {displayName || name || 'Portal'}
                </span>
              </div>
              <div className="px-4 py-6 bg-gray-50 text-center">
                <p className="text-xs text-gray-400">Portal content area</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Client Card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Assign Client</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Assign this portal to a client to generate a live portal URL.
          Skip to save as a reusable template.
        </p>

        {clients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">No client blocks found.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a client block first, or save this as a template.
            </p>
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search clients..."
                className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {filteredClients.map((client) => {
                const selected = selectedClientId === client.id
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(selected ? null : client.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                      selected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span className="text-sm text-foreground truncate">{client.name}</span>
                    {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                )
              })}
              {filteredClients.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No clients match &ldquo;{clientSearch}&rdquo;
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button variant="outline" onClick={() => router.push('/library/portals')} disabled={creating}>
          Cancel
        </Button>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleSubmit(true)}
            disabled={creating || !name.trim()}
          >
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save as Template
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
            disabled={creating || !name.trim() || !selectedClientId}
          >
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Create Portal
          </Button>
        </div>
      </div>
    </div>
  )
}
