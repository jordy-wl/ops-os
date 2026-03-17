'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Block } from '@/lib/context-assembly'

interface BlockListClientProps {
  blocks: Block[]
}

interface BlockTypeDef {
  type_name: string
  display_name: string
}

/**
 * BlockListClient — client component handling type filter + text search.
 * Receives the full pre-fetched block list and filters client-side.
 * Dynamically loads block type definitions from the API so all system
 * and custom types appear in the filter.
 */
export function BlockListClient({ blocks }: BlockListClientProps) {
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<string>('all')
  const [typeDefs, setTypeDefs] = useState<BlockTypeDef[]>([])

  // Fetch block type definitions for filter pills
  useEffect(() => {
    async function loadTypes() {
      try {
        const res = await fetch('/api/block-types')
        if (res.ok) {
          const json = await res.json()
          setTypeDefs((json.data ?? []) as BlockTypeDef[])
        }
      } catch {
        // Fallback to deriving types from blocks if API fails
      }
    }
    loadTypes()
  }, [])

  // Derive available types from both definitions and actual block data
  const availableTypes = useMemo(() => {
    const typeMap = new Map<string, string>()

    // Add types from definitions
    for (const def of typeDefs) {
      typeMap.set(def.type_name, def.display_name)
    }

    // Add any types from blocks that might not be in definitions
    for (const block of blocks) {
      if (!typeMap.has(block.type)) {
        typeMap.set(
          block.type,
          block.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        )
      }
    }

    return Array.from(typeMap.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [typeDefs, blocks])

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
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks…"
            aria-label="Search blocks by name"
            className="h-8 w-full rounded-md border border-border bg-background pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by block type">
          <button
            onClick={() => setActiveType('all')}
            className={cn(
              'h-7 px-3 rounded-full text-[13px] font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeType === 'all'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={activeType === 'all'}
          >
            All
          </button>
          {availableTypes.map(([typeName, displayName]) => (
            <button
              key={typeName}
              onClick={() => setActiveType(typeName)}
              className={cn(
                'h-7 px-3 rounded-full text-[13px] font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activeType === typeName
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
              aria-pressed={activeType === typeName}
            >
              {displayName}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {blocks.length === 0 ? (
            <>
              <p className="text-title text-foreground mb-2">No blocks yet</p>
              <p className="text-[13px] text-muted-foreground mb-6">
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
            <p className="text-[13px] text-muted-foreground">
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
            const jurisdiction = block.metadata?.jurisdiction as string | undefined

            return (
              <li key={block.id}>
                <Link
                  href={`/blocks/${block.id}`}
                  className={cn(
                    'block rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                  aria-label={`${block.name} — ${block.type}`}
                >
                  <div className="p-6">
                    <p className="text-[13px] font-medium text-foreground truncate">{block.name}</p>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex rounded-full bg-muted text-foreground px-2 py-0.5 text-[11px] font-medium">
                        {block.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      {jurisdiction && (
                        <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                          {jurisdiction}
                        </span>
                      )}
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
            )
          })}
        </ul>
      )}
    </div>
  )
}
