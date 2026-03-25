'use client'

import Link from 'next/link'
import { ClipboardList, FileText, ExternalLink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { FormTemplateSummary, DocumentTemplateSummary } from '../wizard-types'
import { AiSuggestBar } from '../ai-assist/ai-suggest-bar'

interface Step3FormsDocsProps {
  formsEnabled: boolean
  documentsEnabled: boolean
  formTemplates: FormTemplateSummary[]
  documentTemplates: DocumentTemplateSummary[]
  selectedFormTemplateIds: string[]
  selectedDocumentTemplateIds: string[]
  onFormToggle: (id: string, checked: boolean) => void
  onDocumentToggle: (id: string, checked: boolean) => void
}

export function Step3FormsDocs({
  formsEnabled,
  documentsEnabled,
  formTemplates,
  documentTemplates,
  selectedFormTemplateIds,
  selectedDocumentTemplateIds,
  onFormToggle,
  onDocumentToggle,
}: Step3FormsDocsProps) {
  return (
    <div className="space-y-6">
      {/* Forms Section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-foreground">Forms</h3>
          {formsEnabled && (
            <Link href="/library/forms" target="_blank">
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" />
                Create New Form
              </Button>
            </Link>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Select form templates clients can fill out in the portal.
        </p>

        {!formsEnabled ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Forms are disabled for this portal.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Enable Forms in Step 1 to configure form templates.
            </p>
          </div>
        ) : formTemplates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-1">No form templates yet</p>
            <p className="text-xs text-muted-foreground">
              Create a form template to make it available here.
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
                      onChange={(e) => onFormToggle(form.id, e.target.checked)}
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
                    <Link
                      href={`/library/forms/${form.id}/builder`}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                    >
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

      <AiSuggestBar
        stepId="forms-docs"
        suggestions={[]}
        disabled
        placeholderText="AI will recommend forms based on request type patterns"
      />

      {/* Documents Section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Documents</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Select document templates to share with clients in the portal.
        </p>

        {!documentsEnabled ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Documents are disabled for this portal.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Enable Documents in Step 1 to configure document templates.
            </p>
          </div>
        ) : documentTemplates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-1">No document templates yet</p>
            <p className="text-xs text-muted-foreground">
              Upload a document template to make it available here.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {documentTemplates.map((doc) => {
              const checked = selectedDocumentTemplateIds.includes(doc.id)
              return (
                <label
                  key={doc.id}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => onDocumentToggle(doc.id, e.target.checked)}
                      className="rounded border-input w-4 h-4 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    </div>
                  </div>
                  {doc.category && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {doc.category}
                    </Badge>
                  )}
                </label>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
