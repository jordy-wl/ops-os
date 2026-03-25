'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ExposedBlockTypeConfig } from '@/lib/portal-constants'
import type {
  FormTemplateSummary,
  ClientOption,
  WorkflowTemplateSummary,
  DocumentTemplateSummary,
  RequestTypeConfigItem,
  WizardStep,
} from './wizard-types'
import { WizardChrome } from './wizard-chrome'
import { Step1Identity } from './steps/step-1-identity'
import { Step2Content } from './steps/step-2-content'
import { Step3FormsDocs } from './steps/step-3-forms-docs'
import { Step4RequestTypes } from './steps/step-4-request-types'
import { Step5Preview } from './steps/step-5-preview'

interface PortalWizardProps {
  formTemplates: FormTemplateSummary[]
  clients: ClientOption[]
  workflowTemplates: WorkflowTemplateSummary[]
  documentTemplates: DocumentTemplateSummary[]
}

export function PortalWizard({
  formTemplates,
  clients,
  workflowTemplates,
  documentTemplates,
}: PortalWizardProps) {
  const router = useRouter()

  // Navigation state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  // Step 1: Identity & Branding
  const [name, setName] = useState('')
  const [dashboardEnabled, setDashboardEnabled] = useState(true)
  const [documentsEnabled, setDocumentsEnabled] = useState(true)
  const [requestsEnabled, setRequestsEnabled] = useState(true)
  const [formsEnabled, setFormsEnabled] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#2563eb')

  // Step 2: Content
  const [exposedBlockTypeConfig, setExposedBlockTypeConfig] = useState<ExposedBlockTypeConfig>({})

  // Step 3: Forms & Documents
  const [selectedFormTemplateIds, setSelectedFormTemplateIds] = useState<string[]>([])
  const [selectedDocumentTemplateIds, setSelectedDocumentTemplateIds] = useState<string[]>([])

  // Step 4: Request Types
  const [requestTypeConfig, setRequestTypeConfig] = useState<RequestTypeConfigItem[]>([])

  // Step 5: Client Assignment
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // Submission state
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derived state
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

  const exposedBlockTypes = useMemo(
    () =>
      Object.entries(exposedBlockTypeConfig)
        .filter(([, v]) => v.enabled)
        .map(([k]) => k),
    [exposedBlockTypeConfig]
  )

  const canAdvance = currentStep === 1 ? name.trim().length > 0 : true

  // --- Handlers ---

  const handleFeatureToggle = useCallback((key: string, enabled: boolean) => {
    const setter = featureSetters[key]
    if (setter) setter(enabled)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTypeToggle = useCallback((typeName: string, enabled: boolean) => {
    setExposedBlockTypeConfig((prev) => ({
      ...prev,
      [typeName]: { enabled, fields: prev[typeName]?.fields ?? {} },
    }))
  }, [])

  const handleFieldToggle = useCallback((typeName: string, fieldKey: string, visible: boolean) => {
    setExposedBlockTypeConfig((prev) => {
      const current = prev[typeName] ?? { enabled: true, fields: {} }
      return {
        ...prev,
        [typeName]: { ...current, fields: { ...current.fields, [fieldKey]: visible } },
      }
    })
  }, [])

  const handleFormToggle = useCallback((id: string, checked: boolean) => {
    setSelectedFormTemplateIds((prev) =>
      checked ? [...prev, id] : prev.filter((fid) => fid !== id)
    )
  }, [])

  const handleDocumentToggle = useCallback((id: string, checked: boolean) => {
    setSelectedDocumentTemplateIds((prev) =>
      checked ? [...prev, id] : prev.filter((did) => did !== id)
    )
  }, [])

  const handleRequestTypeToggle = useCallback((workflowId: string, checked: boolean) => {
    setRequestTypeConfig((prev) => {
      if (checked) return [...prev, { workflow_template_id: workflowId }]
      return prev.filter((rt) => rt.workflow_template_id !== workflowId)
    })
  }, [])

  const handleRequestTypeFormTemplate = useCallback((workflowId: string, formTemplateId: string) => {
    setRequestTypeConfig((prev) =>
      prev.map((rt) =>
        rt.workflow_template_id === workflowId
          ? { ...rt, form_template_id: formTemplateId || undefined }
          : rt
      )
    )
  }, [])

  const handleRequestTypeDisplayName = useCallback((workflowId: string, displayNameValue: string) => {
    setRequestTypeConfig((prev) =>
      prev.map((rt) =>
        rt.workflow_template_id === workflowId
          ? { ...rt, display_name: displayNameValue || undefined }
          : rt
      )
    )
  }, [])

  // Navigation
  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step)
    setError(null)
  }, [])

  const handleNext = useCallback(() => {
    if (currentStep < 5) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]))
      setCurrentStep((currentStep + 1) as WizardStep)
      setError(null)
    }
  }, [currentStep])

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep)
      setError(null)
    }
  }, [currentStep])

  const handleSkip = useCallback(() => {
    if (currentStep >= 2 && currentStep <= 4) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]))
      setCurrentStep((currentStep + 1) as WizardStep)
      setError(null)
    }
  }, [currentStep])

  // Submission (same logic as portal-builder.tsx)
  const handleSubmit = useCallback(async (asTemplate: boolean) => {
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
    if (selectedDocumentTemplateIds.length > 0) {
      brandingOverrides.document_template_ids = selectedDocumentTemplateIds
    }

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
  }, [
    name, selectedClientId, displayName, logoUrl, primaryColor,
    selectedDocumentTemplateIds, dashboardEnabled, documentsEnabled,
    requestsEnabled, formsEnabled, exposedBlockTypes, exposedBlockTypeConfig,
    selectedFormTemplateIds, requestTypeConfig, router,
  ])

  // --- Render current step ---

  function renderStep() {
    switch (currentStep) {
      case 1:
        return (
          <Step1Identity
            name={name}
            onNameChange={setName}
            displayName={displayName}
            onDisplayNameChange={setDisplayName}
            logoUrl={logoUrl}
            onLogoUrlChange={setLogoUrl}
            primaryColor={primaryColor}
            onPrimaryColorChange={setPrimaryColor}
            featureState={featureState}
            onFeatureToggle={handleFeatureToggle}
          />
        )
      case 2:
        return (
          <Step2Content
            exposedBlockTypeConfig={exposedBlockTypeConfig}
            onTypeToggle={handleTypeToggle}
            onFieldToggle={handleFieldToggle}
          />
        )
      case 3:
        return (
          <Step3FormsDocs
            formsEnabled={formsEnabled}
            documentsEnabled={documentsEnabled}
            formTemplates={formTemplates}
            documentTemplates={documentTemplates}
            selectedFormTemplateIds={selectedFormTemplateIds}
            selectedDocumentTemplateIds={selectedDocumentTemplateIds}
            onFormToggle={handleFormToggle}
            onDocumentToggle={handleDocumentToggle}
          />
        )
      case 4:
        return (
          <Step4RequestTypes
            requestsEnabled={requestsEnabled}
            workflowTemplates={workflowTemplates}
            formTemplates={formTemplates}
            requestTypeConfig={requestTypeConfig}
            onRequestTypeToggle={handleRequestTypeToggle}
            onRequestTypeFormTemplate={handleRequestTypeFormTemplate}
            onRequestTypeDisplayName={handleRequestTypeDisplayName}
          />
        )
      case 5:
        return (
          <Step5Preview
            name={name}
            displayName={displayName}
            logoUrl={logoUrl}
            primaryColor={primaryColor}
            dashboardEnabled={dashboardEnabled}
            documentsEnabled={documentsEnabled}
            requestsEnabled={requestsEnabled}
            formsEnabled={formsEnabled}
            exposedBlockTypeConfig={exposedBlockTypeConfig}
            selectedFormCount={selectedFormTemplateIds.length}
            selectedDocumentCount={selectedDocumentTemplateIds.length}
            requestTypeConfig={requestTypeConfig}
            clients={clients}
            selectedClientId={selectedClientId}
            onClientSelect={setSelectedClientId}
            creating={creating}
            error={error}
            onSubmit={handleSubmit}
          />
        )
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/library/portals"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Portals
      </Link>

      <WizardChrome
        currentStep={currentStep}
        completedSteps={completedSteps}
        canAdvance={canAdvance}
        creating={creating}
        onStepClick={goToStep}
        onBack={handleBack}
        onNext={handleNext}
        onSkip={handleSkip}
      >
        {renderStep()}
      </WizardChrome>
    </div>
  )
}
