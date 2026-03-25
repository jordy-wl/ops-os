'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Globe, Copy, Check, ExternalLink, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { OverviewTab } from './portal-detail-tabs/overview-tab'
import { FeaturesTab } from './portal-detail-tabs/features-tab'
import { ContentTab } from './portal-detail-tabs/content-tab'
import { BrandingTab } from './portal-detail-tabs/branding-tab'
import { SettingsTab } from './portal-detail-tabs/settings-tab'

export interface RequestTypeConfigItem {
  workflow_template_id: string
  form_template_id?: string
  display_name?: string
}

export interface PortalConfig {
  id: string
  org_id: string
  client_block_id: string | null
  name: string
  dashboard_enabled: boolean
  documents_enabled: boolean
  requests_enabled: boolean
  forms_enabled: boolean
  exposed_block_types: string[]
  exposed_block_ids: string[] | null
  branding_overrides: Record<string, unknown> | null
  is_active: boolean
  is_template: boolean
  form_template_ids: string[] | null
  portal_token: string | null
  exposed_block_type_config: Record<string, { enabled: boolean; fields: Record<string, boolean> }>
  request_type_config: RequestTypeConfigItem[] | null
  created_at: string
  updated_at: string
}

export interface FormTemplateSummary {
  id: string
  name: string
  questionCount: number
  status: string
}

export interface WorkflowTemplateSummary {
  id: string
  name: string
  description: string
}

interface PortalDetailViewProps {
  config: PortalConfig
  clientName: string
  clientId: string | null
  formTemplates: FormTemplateSummary[]
  workflowTemplates: WorkflowTemplateSummary[]
}

export function PortalDetailView({
  config: initialConfig,
  clientName,
  clientId,
  formTemplates,
  workflowTemplates,
}: PortalDetailViewProps) {
  const [config, setConfig] = useState<PortalConfig>(initialConfig)
  const [copied, setCopied] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  // Debounced auto-save (500ms)
  const saveConfig = useCallback(
    async (updates: Partial<PortalConfig>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/portal-configs/${config.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
        } catch {
          // Silent auto-save failure
        }
      }, 500)
    },
    [config.id]
  )

  const updateConfig = useCallback(
    (updates: Partial<PortalConfig>) => {
      setConfig((prev) => ({ ...prev, ...updates }))
      saveConfig(updates)
    },
    [saveConfig]
  )

  const portalUrl = config.portal_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${config.portal_token}`
    : null

  const handleCopy = useCallback(() => {
    if (!portalUrl) return
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [portalUrl])

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link
              href="/library/portals"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Portals
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground font-medium truncate max-w-[200px]">
            {config.name}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Globe className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold text-foreground">
              {config.name}
            </h1>
            {config.is_template ? (
              <Badge variant="outline" className="text-[10px]">Template</Badge>
            ) : (
              <Badge
                variant={config.is_active ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {config.is_active ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>
          {clientId ? (
            <p className="text-sm text-muted-foreground">
              Client:{' '}
              <Link
                href={`/blocks/${clientId}`}
                className="text-primary hover:underline"
              >
                {clientName}
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Reusable template — assign to a client to create a live portal
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {portalUrl && config.is_active && (
            <>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="w-3.5 h-3.5 mr-1 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 mr-1" />
                )}
                {copied ? 'Copied' : 'Copy Link'}
              </Button>
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Open Portal
                  </span>
                </Button>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            configId={config.id}
            portalUrl={portalUrl}
            isActive={config.is_active}
          />
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <FeaturesTab config={config} onUpdate={updateConfig} />
        </TabsContent>

        <TabsContent value="content" className="mt-4">
          <ContentTab
            config={config}
            onUpdate={updateConfig}
            formTemplates={formTemplates}
            workflowTemplates={workflowTemplates}
            clientId={clientId}
          />
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <BrandingTab config={config} onUpdate={updateConfig} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <SettingsTab config={config} onUpdate={updateConfig} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
