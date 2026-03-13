'use client'

import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface WorkflowTabShellProps {
  templatesPanel: ReactNode
  jobsPanel: ReactNode
}

export function WorkflowTabShell({ templatesPanel, jobsPanel }: WorkflowTabShellProps) {
  return (
    <Tabs defaultValue="templates" className="w-full">
      <TabsList aria-label="Workflow sections" className="mb-6">
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="jobs">Jobs</TabsTrigger>
      </TabsList>

      <TabsContent value="templates">
        {templatesPanel}
      </TabsContent>

      <TabsContent value="jobs">
        {jobsPanel}
      </TabsContent>
    </Tabs>
  )
}
