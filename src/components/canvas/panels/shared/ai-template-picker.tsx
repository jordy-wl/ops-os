'use client'

import { useState, useCallback, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { FieldLabel, SelectInput, TextArea, CheckboxInput } from './form-primitives'
import { getTemplatesForNodeType, type AIPromptTemplate } from '@/lib/workflow/ai-prompt-templates'

export type SaveResultDestination = 'source_record' | 'new_record' | 'context_only'

export interface AITemplatePickerProps {
  nodeType: 'ai_analysis' | 'ai_classify' | 'ai_summarise' | 'ai_risk'
  selectedTemplateId?: string
  onSelect: (template: AIPromptTemplate | null) => void
  prompt: string
  onPromptChange: (prompt: string) => void
  categories?: string[]
  onCategoriesChange?: (categories: string[]) => void
  riskCategories?: string[]
  onRiskCategoriesChange?: (categories: string[]) => void
  includeOrgPolicies?: boolean
  onIncludeOrgPoliciesChange?: (include: boolean) => void
  outputFormat?: 'json' | 'text'
  onOutputFormatChange?: (format: 'json' | 'text') => void
  saveResultTo?: SaveResultDestination
  onSaveResultToChange?: (dest: SaveResultDestination) => void
}

const SAVE_RESULT_OPTIONS: { value: string; label: string }[] = [
  { value: 'source_record', label: 'Source Record (default)' },
  { value: 'new_record', label: 'New Record' },
  { value: 'context_only', label: 'Workflow Context Only' },
]

function TagInput({
  id,
  tags,
  onChange,
  placeholder,
}: {
  id: string
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [inputValue, setInputValue] = useState('')

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim()
      if (tag && !tags.includes(tag)) {
        onChange([...tags, tag])
      }
      setInputValue('')
    },
    [tags, onChange],
  )

  const removeTag = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index))
    },
    [tags, onChange],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        addTag(inputValue)
      }
      if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        removeTag(tags.length - 1)
      }
    },
    [inputValue, tags, addTag, removeTag],
  )

  return (
    <div
      className="flex flex-wrap gap-1 p-1.5 rounded-md border border-input bg-background min-h-[32px] focus-within:ring-2 focus-within:ring-ring"
      role="group"
      aria-label={placeholder ?? 'Tags'}
    >
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="h-3 w-3 cursor-pointer hover:text-destructive inline-flex items-center justify-center"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) addTag(inputValue)
        }}
        placeholder={tags.length === 0 ? (placeholder ?? 'Type and press Enter') : ''}
        className="border-0 bg-transparent outline-none text-xs flex-1 min-w-[60px]"
      />
    </div>
  )
}

export function AITemplatePicker({
  nodeType,
  selectedTemplateId,
  onSelect,
  prompt,
  onPromptChange,
  categories,
  onCategoriesChange,
  riskCategories,
  onRiskCategoriesChange,
  includeOrgPolicies,
  onIncludeOrgPoliciesChange,
  outputFormat,
  onOutputFormatChange,
  saveResultTo,
  onSaveResultToChange,
}: AITemplatePickerProps) {
  const templates = getTemplatesForNodeType(nodeType)

  const selectedTemplate = selectedTemplateId
    ? templates.find((t) => t.id === selectedTemplateId) ?? null
    : null

  const templateOptions = [
    { value: '__custom__', label: 'Custom...' },
    ...templates.map((t) => ({ value: t.id, label: t.name })),
  ]

  const handleTemplateChange = useCallback(
    (value: string) => {
      if (value === '__custom__') {
        onSelect(null)
        return
      }
      const template = templates.find((t) => t.id === value)
      if (template) {
        onSelect(template)
        onPromptChange(template.prompt)
        if (template.categories && onCategoriesChange) {
          onCategoriesChange([...template.categories])
        }
        if (template.riskCategories && onRiskCategoriesChange) {
          onRiskCategoriesChange([...template.riskCategories])
        }
        if (template.includeOrgPolicies !== undefined && onIncludeOrgPoliciesChange) {
          onIncludeOrgPoliciesChange(template.includeOrgPolicies)
        }
        if (template.outputFormat && onOutputFormatChange) {
          onOutputFormatChange(template.outputFormat)
        }
      }
    },
    [templates, onSelect, onPromptChange, onCategoriesChange, onRiskCategoriesChange, onIncludeOrgPoliciesChange, onOutputFormatChange],
  )

  return (
    <div className="space-y-3">
      {/* Template dropdown */}
      <div>
        <FieldLabel htmlFor="ai-template">Template</FieldLabel>
        <SelectInput
          id="ai-template"
          value={selectedTemplateId ?? '__custom__'}
          onChange={handleTemplateChange}
          options={templateOptions}
        />
        {selectedTemplate && (
          <p className="mt-1 text-xs text-muted-foreground">{selectedTemplate.description}</p>
        )}
      </div>

      {/* Prompt textarea */}
      <div>
        <FieldLabel htmlFor="ai-prompt">Prompt</FieldLabel>
        <TextArea
          id="ai-prompt"
          value={prompt}
          onChange={onPromptChange}
          placeholder="Enter your AI prompt..."
          rows={4}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use {'{{variable}}'} to insert dynamic values
        </p>
      </div>

      {/* Categories — classify nodes only */}
      {nodeType === 'ai_classify' && onCategoriesChange && (
        <div>
          <FieldLabel htmlFor="ai-categories">Categories</FieldLabel>
          <TagInput
            id="ai-categories"
            tags={categories ?? []}
            onChange={onCategoriesChange}
            placeholder="Add category and press Enter"
          />
          {(categories ?? []).length < 2 && (
            <p className="mt-1 text-xs text-destructive">Minimum 2 categories required</p>
          )}
        </div>
      )}

      {/* Risk Categories — risk nodes only */}
      {nodeType === 'ai_risk' && onRiskCategoriesChange && (
        <div>
          <FieldLabel htmlFor="ai-risk-categories">Risk Categories</FieldLabel>
          <TagInput
            id="ai-risk-categories"
            tags={riskCategories ?? []}
            onChange={onRiskCategoriesChange}
            placeholder="Add risk category and press Enter"
          />
        </div>
      )}

      {/* Include Org Policies — risk nodes only */}
      {nodeType === 'ai_risk' && onIncludeOrgPoliciesChange && (
        <CheckboxInput
          id="ai-include-org-policies"
          checked={includeOrgPolicies ?? false}
          onChange={onIncludeOrgPoliciesChange}
          label="Include organisation policies"
        />
      )}

      {/* Output Format — analysis nodes only */}
      {nodeType === 'ai_analysis' && onOutputFormatChange && (
        <div>
          <FieldLabel htmlFor="ai-output-format">Output Format</FieldLabel>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onOutputFormatChange('json')}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                (outputFormat ?? 'json') === 'json'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted'
              }`}
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => onOutputFormatChange('text')}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                outputFormat === 'text'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted'
              }`}
            >
              Text
            </button>
          </div>
        </div>
      )}

      {/* Save Result To — always visible */}
      <div>
        <FieldLabel htmlFor="ai-save-result">Save Result To</FieldLabel>
        <SelectInput
          id="ai-save-result"
          value={saveResultTo ?? 'source_record'}
          onChange={(v) => onSaveResultToChange?.(v as SaveResultDestination)}
          options={SAVE_RESULT_OPTIONS}
        />
      </div>
    </div>
  )
}
