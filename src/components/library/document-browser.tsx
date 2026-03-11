'use client'

import { useState } from 'react'
import Link from 'next/link'

type DocumentTemplate = {
  id: string
  name: string
  type: string
  state: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  contract: 'Contract',
  proposal: 'Proposal',
  nda: 'NDA',
  report: 'Report',
  letter: 'Letter',
  invoice: 'Invoice',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  contract: 'bg-blue-100 text-blue-800',
  proposal: 'bg-green-100 text-green-800',
  nda: 'bg-purple-100 text-purple-800',
  report: 'bg-amber-100 text-amber-800',
  letter: 'bg-gray-100 text-gray-800',
  invoice: 'bg-cyan-100 text-cyan-800',
  other: 'bg-gray-100 text-gray-600',
}

export function DocumentBrowser({
  templates,
  hasBrandKit,
}: {
  templates: DocumentTemplate[]
  hasBrandKit: boolean
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const categories = [...new Set(
    templates
      .map((t) => (t.metadata?.category as string) ?? 'other')
      .filter(Boolean)
  )]

  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      ((t.metadata?.category as string) ?? '').toLowerCase().includes(search.toLowerCase())

    const matchesCategory =
      !categoryFilter ||
      (t.metadata?.category as string) === categoryFilter

    return matchesSearch && matchesCategory
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Document Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {templates.length} template{templates.length !== 1 ? 's' : ''}
            {!hasBrandKit && (
              <span className="ml-2 text-amber-600">
                — <Link href="/settings/brand" className="underline">Set up brand kit</Link> for branded documents
              </span>
            )}
          </p>
        </div>
        <Link
          href="/library/documents/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          + New Template
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          aria-label="Search document templates"
          className="flex-1 min-w-[200px] rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Category filters">
          <button
            onClick={() => setCategoryFilter(null)}
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
              onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
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

      {/* Template Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {templates.length === 0 ? (
            <div>
              <p className="text-lg font-medium mb-2">No templates yet</p>
              <p className="text-sm">Create your first document template to start generating documents.</p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-medium mb-2">No matches</p>
              <button
                onClick={() => { setSearch(''); setCategoryFilter(null) }}
                className="text-sm text-muted-foreground underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
          {filtered.map((t) => {
            const category = (t.metadata?.category as string) ?? 'other'
            const variables = (t.metadata?.variables as Array<{ name: string }>) ?? []
            const outputFormat = (t.metadata?.output_format as string) ?? 'html'

            return (
              <Link
                key={t.id}
                href={`/blocks/${t.id}`}
                className="block border border-border rounded-lg p-4 hover:border-ring hover:shadow-sm transition group"
                role="listitem"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-foreground group-hover:text-foreground truncate">
                    {t.name}
                  </h3>
                  <span className={`shrink-0 ml-2 px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other}`}>
                    {CATEGORY_LABELS[category] ?? category}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {variables.length > 0 && (
                    <p>{variables.length} variable{variables.length !== 1 ? 's' : ''}: {variables.slice(0, 3).map(v => v.name).join(', ')}{variables.length > 3 ? '...' : ''}</p>
                  )}
                  <p className="flex items-center justify-between">
                    <span>Format: {outputFormat.toUpperCase()}</span>
                    <span>{new Date(t.updated_at).toLocaleDateString()}</span>
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
