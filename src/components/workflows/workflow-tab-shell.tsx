'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface WorkflowTabShellProps {
  templatesPanel: ReactNode
  jobsPanel: ReactNode
}

const TABS = [
  { key: 'templates', label: 'Templates' },
  { key: 'jobs', label: 'Jobs' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function WorkflowTabShell({ templatesPanel, jobsPanel }: WorkflowTabShellProps) {
  const [active, setActive] = useState<TabKey>('templates')

  return (
    <div>
      <div role="tablist" aria-label="Workflow sections" className="flex gap-1 border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            aria-controls={`panel-${tab.key}`}
            id={`tab-${tab.key}`}
            onClick={() => setActive(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t',
              active === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-ring'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="panel-templates"
        aria-labelledby="tab-templates"
        hidden={active !== 'templates'}
      >
        {templatesPanel}
      </div>

      <div
        role="tabpanel"
        id="panel-jobs"
        aria-labelledby="tab-jobs"
        hidden={active !== 'jobs'}
      >
        {jobsPanel}
      </div>
    </div>
  )
}
