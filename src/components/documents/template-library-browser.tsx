'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TemplateCard, type TemplateData } from './template-card'
import { TemplateUploadDialog } from './template-upload-dialog'

const CATEGORY_LABELS: Record<string, string> = {
  contract: 'Contract',
  proposal: 'Proposal',
  nda: 'NDA',
  report: 'Report',
  letter: 'Letter',
  invoice: 'Invoice',
  other: 'Other',
}

interface TemplateLibraryBrowserProps {
  templates: TemplateData[]
  hasBrandKit: boolean
}

export function TemplateLibraryBrowser({
  templates,
  hasBrandKit,
}: TemplateLibraryBrowserProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const categories = [
    ...new Set(
      templates
        .map((t) => (t.metadata?.category as string) ?? 'other')
        .filter(Boolean)
    ),
  ]

  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      ((t.metadata?.category as string) ?? '')
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      ((t.metadata?.structure_description as string) ?? '')
        .toLowerCase()
        .includes(search.toLowerCase())

    const matchesCategory =
      !categoryFilter ||
      (t.metadata?.category as string) === categoryFilter

    return matchesSearch && matchesCategory
  })

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? 's' : ''}
          {!hasBrandKit && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              — Set up a{' '}
              <a href="/settings/brand" className="underline">
                brand kit
              </a>{' '}
              for branded documents
            </span>
          )}
        </p>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          + Upload Template
        </Button>
      </div>

      {/* Search + category filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          aria-label="Search templates"
          className="flex-1 min-w-[200px] rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Category filters">
          <button
            onClick={() => setCategoryFilter(null)}
            aria-pressed={!categoryFilter}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              !categoryFilter
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-ring'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setCategoryFilter(cat === categoryFilter ? null : cat)
              }
              aria-pressed={cat === categoryFilter}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                cat === categoryFilter
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-ring'
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {templates.length === 0 ? (
            <div>
              <p className="text-lg font-medium mb-2">No templates yet</p>
              <p className="text-sm mb-4">
                Upload a reference document to get started with AI-powered document generation.
              </p>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                Upload Your First Template
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-lg font-medium mb-2">No matches</p>
              <button
                onClick={() => {
                  setSearch('')
                  setCategoryFilter(null)
                }}
                className="text-sm text-muted-foreground underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          role="list"
        >
          {filtered.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <TemplateUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
    </div>
  )
}
