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

const TYPE_STYLES: Record<string, string> = {
  client: 'bg-blue-100 text-blue-800',
  deal: 'bg-green-100 text-green-800',
  project: 'bg-yellow-100 text-yellow-800',
  contract: 'bg-purple-100 text-purple-800',
  contact: 'bg-gray-100 text-gray-800',
  invoice: 'bg-orange-100 text-orange-800',
  task: 'bg-pink-100 text-pink-800',
}

const STATE_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  draft: 'bg-gray-50 text-gray-600',
  archived: 'bg-gray-50 text-gray-400',
  completed: 'bg-blue-50 text-blue-700',
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
          <h1 className="text-2xl font-bold text-gray-900">Block Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            {blocks.length} block{blocks.length !== 1 ? 's' : ''} across {types.length} type{types.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search blocks by name"
              placeholder="Search blocks..."
              className="h-9 w-56 rounded-md border border-gray-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div className="flex rounded-md border border-gray-200" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={cn(
                'p-2 rounded-l-md',
                viewMode === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
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
                'p-2 rounded-r-md border-l border-gray-200',
                viewMode === 'list' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
              )}
            >
              <List className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">List view</span>
            </button>
          </div>
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by block type">
        <button
          type="button"
          onClick={() => setActiveType('all')}
          aria-pressed={activeType === 'all'}
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
            activeType === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
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
              'rounded-full px-3 py-1 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900',
              activeType === typeName
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
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
                    'block rounded-lg border p-4 hover:border-gray-400 hover:shadow-sm transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{block.name}</h3>
                    </div>
                    <span className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize shrink-0',
                      TYPE_STYLES[block.type] ?? 'bg-gray-100 text-gray-800'
                    )}>
                      {block.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className={cn(
                      'inline-flex rounded-full px-2 py-0.5 font-medium capitalize',
                      STATE_STYLES[block.state] ?? 'bg-gray-50 text-gray-600'
                    )}>
                      {block.state}
                    </span>
                    <time dateTime={block.updated_at}>
                      {new Date(block.updated_at).toLocaleDateString()}
                    </time>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border divide-y">
            {filtered.map((block) => (
              <Link
                key={block.id}
                href={`/blocks/${block.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <Box className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{block.name}</p>
                  <p className="text-xs text-gray-500">
                    {block.state} &middot; Updated{' '}
                    <time dateTime={block.updated_at}>{new Date(block.updated_at).toLocaleDateString()}</time>
                  </p>
                </div>
                <span className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize shrink-0',
                  TYPE_STYLES[block.type] ?? 'bg-gray-100 text-gray-800'
                )}>
                  {block.type}
                </span>
              </Link>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {blocks.length === 0 ? (
            <>
              <p className="text-lg font-semibold text-gray-900 mb-2">No blocks yet</p>
              <p className="text-sm text-gray-500 mb-6">Create your first block from the dashboard.</p>
              <Link
                href="/dashboard"
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium',
                  'bg-gray-900 text-white hover:bg-gray-700',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
                )}
              >
                Go to dashboard
              </Link>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              No blocks match your filter.{' '}
              <button onClick={() => { setSearch(''); setActiveType('all') }} className="underline">
                Clear filters
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
