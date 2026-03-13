'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Search,
  LayoutGrid,
  List,
  Box,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Block {
  id: string
  name: string
  type: string
  state: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

interface TypeDefinition {
  type_name: string
  label: string | null
  icon: string | null
  color: string | null
  field_schema: Record<string, unknown> | null
}

interface BlockBrowserProps {
  blocks: Block[]
  typeDefinitions: TypeDefinition[]
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const STATE_STYLES: Record<string, string> = {
  active: 'bg-success/10 text-success',
  draft: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
  completed: 'bg-primary/10 text-primary',
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BlockBrowser({ blocks, typeDefinitions }: BlockBrowserProps) {
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Build type list from actual blocks + definitions
  const typeMap = new Map<string, { label: string; color: string | null; count: number }>()
  for (const block of blocks) {
    const existing = typeMap.get(block.type)
    if (existing) {
      existing.count++
    } else {
      const def = typeDefinitions.find((d) => d.type_name === block.type)
      typeMap.set(block.type, {
        label: def?.label ?? block.type,
        color: def?.color ?? null,
        count: 1,
      })
    }
  }

  const types = Array.from(typeMap.entries()).sort((a, b) => b[1].count - a[1].count)

  // Filter blocks
  const filtered = blocks.filter((b) => {
    if (activeType !== 'all' && b.type !== activeType) return false
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-page font-semibold text-foreground">Block Library</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {blocks.length} block{blocks.length !== 1 ? 's' : ''} across {types.length} type{types.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search blocks by name"
              placeholder="Search blocks..."
              className="h-8 w-56 rounded-md border border-border bg-background pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex rounded-md border border-border" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={cn(
                'p-2 rounded-l-md',
                viewMode === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Grid view</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={cn(
                'p-2 rounded-r-md border-l border-border',
                viewMode === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <List className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">List view</span>
            </button>
          </div>
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-6" role="group" aria-label="Filter by block type">
        <button
          type="button"
          onClick={() => setActiveType('all')}
          aria-pressed={activeType === 'all'}
          className={cn(
            'h-7 rounded-full px-3 text-[13px] font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            activeType === 'all'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          All ({blocks.length})
        </button>
        {types.map(([typeName, info]) => (
          <button
            key={typeName}
            type="button"
            onClick={() => setActiveType(typeName)}
            aria-pressed={activeType === typeName}
            className={cn(
              'h-7 rounded-full px-3 text-[13px] font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeType === typeName
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {info.label} ({info.count})
          </button>
        ))}
      </div>

      {/* Block grid/list */}
      {filtered.length > 0 ? (
        viewMode === 'grid' ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label={`${filtered.length} blocks`}>
            {filtered.map((block) => (
              <li key={block.id}>
                <Link
                  href={`/blocks/${block.id}`}
                  aria-label={`${block.name} — ${block.type}`}
                  className={cn(
                    'block rounded-md border border-border bg-card hover:bg-muted/50 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <div className="p-4">
                    <h3 className="text-[13px] font-medium text-foreground truncate">{block.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex rounded-full bg-muted text-foreground px-2 py-0.5 text-[11px] font-medium">
                        {block.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                        STATE_STYLES[block.state] ?? 'bg-muted text-muted-foreground'
                      )}>
                        {block.state}
                      </span>
                    </div>
                    <p className="mt-2 text-muted-foreground text-[12px]">
                      Updated{' '}
                      <time dateTime={block.updated_at}>
                        {new Date(block.updated_at).toLocaleDateString()}
                      </time>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-border bg-card divide-y divide-border">
            {filtered.map((block) => (
              <Link
                key={block.id}
                href={`/blocks/${block.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Box className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{block.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {block.state} &middot; Updated{' '}
                    <time dateTime={block.updated_at}>{new Date(block.updated_at).toLocaleDateString()}</time>
                  </p>
                </div>
                <span className="shrink-0 inline-flex rounded-full bg-muted text-foreground px-2 py-0.5 text-[11px] font-medium">
                  {block.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              </Link>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {blocks.length === 0 ? (
            <>
              <p className="text-[13px] font-medium text-foreground mb-2">No blocks yet</p>
              <p className="text-[13px] text-muted-foreground mb-6">Create your first block from the dashboard.</p>
              <Link
                href="/dashboard"
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium',
                  'bg-primary text-primary-foreground hover:bg-primary/80',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                Go to dashboard
              </Link>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              No blocks match your filter.{' '}
              <button onClick={() => { setSearch(''); setActiveType('all') }} className="underline hover:no-underline">
                Clear filters
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
