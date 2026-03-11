'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Block } from '@/lib/context-assembly'

interface BlockListClientProps {
  blocks: Block[]
}

const BLOCK_TYPES = ['client', 'deal', 'project', 'contract', 'contact'] as const
type BlockType = (typeof BLOCK_TYPES)[number]

const TYPE_STYLES: Record<string, string> = {
  client:   'bg-blue-100 text-blue-800',
  deal:     'bg-green-100 text-green-800',
  project:  'bg-yellow-100 text-yellow-800',
  contract: 'bg-purple-100 text-purple-800',
  contact:  'bg-gray-100 text-gray-800',
}

/**
 * BlockListClient — client component handling type filter + text search.
 * Receives the full pre-fetched block list and filters client-side.
 * No additional network requests needed for filter/search interactions.
 *
 * @param blocks - All blocks for the current org (pre-fetched by server component)
 */
export function BlockListClient({ blocks }: BlockListClientProps) {
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<BlockType | 'all'>('all')

  // Apply type filter then text search (case-insensitive on block name)
  const filtered = blocks.filter((block) => {
    const matchesType = activeType === 'all' || block.type === activeType
    const matchesSearch = block.name.toLowerCase().includes(search.toLowerCase())
    return matchesType && matchesSearch
  })

  return (
    <div>
      {/* Search + filter controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks…"
          aria-label="Search blocks by name"
          className="h-9 rounded-md border border-border px-3 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {/* Type filter buttons */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by block type">
          <button
            onClick={() => setActiveType('all')}
            className={cn(
              'h-9 px-3 rounded-md text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeType === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background border border-border text-foreground hover:bg-muted'
            )}
            aria-pressed={activeType === 'all'}
          >
            All
          </button>
          {BLOCK_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={cn(
                'h-9 px-3 rounded-md text-sm font-medium capitalize transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activeType === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border border-border text-foreground hover:bg-muted'
              )}
              aria-pressed={activeType === type}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {blocks.length === 0 ? (
            <>
              <p className="text-lg font-semibold text-foreground mb-2">No blocks yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                Create your first block from the dashboard.
              </p>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Go to dashboard
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No blocks match your filter.{' '}
              <button
                onClick={() => { setSearch(''); setActiveType('all') }}
                className="underline hover:no-underline"
              >
                Clear filters
              </button>
            </p>
          )}
        </div>
      ) : (
        <ul
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
          aria-label={`${filtered.length} block${filtered.length !== 1 ? 's' : ''}`}
        >
          {filtered.map((block) => {
            const typeStyle = TYPE_STYLES[block.type] ?? 'bg-gray-100 text-gray-800'
            const jurisdiction = block.metadata?.jurisdiction as string | undefined

            return (
              <li key={block.id}>
                <Link
                  href={`/blocks/${block.id}`}
                  className={cn(
                    'block rounded-lg border p-4 hover:border-ring hover:shadow-sm transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                  aria-label={`${block.name} — ${block.type}`}
                >
                  {/* Type badge + name */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize shrink-0',
                        typeStyle
                      )}
                    >
                      {block.type}
                    </span>
                    {jurisdiction && (
                      <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                        {jurisdiction}
                      </span>
                    )}
                  </div>

                  <p className="font-medium text-foreground truncate">{block.name}</p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated{' '}
                    <time dateTime={block.updated_at}>
                      {new Date(block.updated_at).toLocaleDateString()}
                    </time>
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
