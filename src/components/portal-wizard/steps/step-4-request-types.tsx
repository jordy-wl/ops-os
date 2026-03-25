'use client'

import { GitBranch } from 'lucide-react'
import type {
  WorkflowTemplateSummary,
  FormTemplateSummary,
  RequestTypeConfigItem,
} from '../wizard-types'
import { AiSuggestBar } from '../ai-assist/ai-suggest-bar'

interface Step4RequestTypesProps {
  requestsEnabled: boolean
  workflowTemplates: WorkflowTemplateSummary[]
  formTemplates: FormTemplateSummary[]
  requestTypeConfig: RequestTypeConfigItem[]
  onRequestTypeToggle: (workflowId: string, checked: boolean) => void
  onRequestTypeFormTemplate: (workflowId: string, formTemplateId: string) => void
  onRequestTypeDisplayName: (workflowId: string, displayName: string) => void
}

export function Step4RequestTypes({
  requestsEnabled,
  workflowTemplates,
  formTemplates,
  requestTypeConfig,
  onRequestTypeToggle,
  onRequestTypeFormTemplate,
  onRequestTypeDisplayName,
}: Step4RequestTypesProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Request Types</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Select workflow templates that clients can trigger as request types.
          When configured, clients see request type cards instead of a generic form.
        </p>
      </div>

      {!requestsEnabled ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Requests are disabled for this portal.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Enable Requests in Step 1 to configure request types.
          </p>
        </div>
      ) : (
        <>
          <AiSuggestBar
            stepId="request-types"
            suggestions={[]}
            disabled
            placeholderText="AI will map request types to intake forms based on field patterns"
          />

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
                        onChange={(e) => onRequestTypeToggle(wf.id, e.target.checked)}
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

                    {isSelected && (
                      <div className="px-4 pb-3 pt-0 space-y-3 border-t border-border/50 mt-1 pt-3">
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
                            onChange={(e) => onRequestTypeDisplayName(wf.id, e.target.value)}
                            placeholder={wf.name}
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>

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
                            onChange={(e) => onRequestTypeFormTemplate(wf.id, e.target.value)}
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
        </>
      )}
    </div>
  )
}
