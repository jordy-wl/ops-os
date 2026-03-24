'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { ClipboardList, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { COMMON_BLOCK_TYPES } from '@/lib/portal-constants'
import type { PortalConfig, FormTemplateSummary } from '../portal-detail-view'

interface ContentTabProps {
  config: PortalConfig
  onUpdate: (updates: Partial<PortalConfig>) => void
  formTemplates: FormTemplateSummary[]
  clientId: string | null
}

export function ContentTab({
  config,
  onUpdate,
  formTemplates,
  clientId,
}: ContentTabProps) {
  const handleBlockTypeToggle = useCallback(
    (typeValue: string, checked: boolean) => {
      const current = config.exposed_block_types ?? []
      const updated = checked
        ? [...current, typeValue]
        : current.filter((t) => t !== typeValue)
      onUpdate({ exposed_block_types: updated })
    },
    [config.exposed_block_types, onUpdate]
  )

  return (
    <div className="space-y-6">
      {/* Block types */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Exposed Block Types
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Select which types of records clients can see in their portal
          dashboard.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {COMMON_BLOCK_TYPES.map((bt) => {
            const checked = (config.exposed_block_types ?? []).includes(
              bt.value
            )
            return (
              <label
                key={bt.value}
                className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    handleBlockTypeToggle(bt.value, e.target.checked)
                  }
                  className="rounded border-input w-4 h-4"
                />
                <span className="text-sm text-foreground">{bt.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Form templates */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Forms
            </h3>
            <p className="text-xs text-muted-foreground">
              Form templates available to clients when Forms is enabled.
            </p>
          </div>
        </div>

        {formTemplates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-1">
              No form templates yet
            </p>
            <p className="text-xs text-muted-foreground">
              Create a form template block to make it available in the portal.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {formTemplates.map((form) => (
              <div
                key={form.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {form.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {form.questionCount} question
                    {form.questionCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={
                      form.status === 'active'
                        ? 'default'
                        : 'secondary'
                    }
                    className="text-[10px]"
                  >
                    {form.status}
                  </Badge>
                  <Link href={`/blocks/${form.id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Edit Questions
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
