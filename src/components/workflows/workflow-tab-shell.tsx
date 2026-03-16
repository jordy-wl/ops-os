'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WorkflowMetricsPanel } from './workflow-metrics-panel'

interface WorkflowTabShellProps {
  templatesPanel: ReactNode
  jobsPanel: ReactNode
  templateIds?: string[]
}

export function WorkflowTabShell({ templatesPanel, jobsPanel, templateIds }: WorkflowTabShellProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    templateIds?.[0] ?? null
  )

  return (
    <Tabs defaultValue="templates" className="w-full">
      <TabsList aria-label="Workflow sections" className="mb-6">
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="jobs">Jobs</TabsTrigger>
        <TabsTrigger value="metrics">Metrics</TabsTrigger>
      </TabsList>

      <TabsContent value="templates">
        {templatesPanel}
      </TabsContent>

      <TabsContent value="jobs">
        {jobsPanel}
      </TabsContent>

      <TabsContent value="metrics">
        {templateIds && templateIds.length > 0 ? (
          <div className="space-y-4">
            {templateIds.length > 1 && (
              <div className="flex items-center gap-2">
                <label htmlFor="metrics-template" className="text-sm text-muted-foreground">
                  Template:
                </label>
                <select
                  id="metrics-template"
                  value={selectedTemplateId ?? ''}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {templateIds.map((id) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </div>
            )}
            {selectedTemplateId && (
              <WorkflowMetricsPanel templateId={selectedTemplateId} />
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              Create a workflow template to see metrics.
            </p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
