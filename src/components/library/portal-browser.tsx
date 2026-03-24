'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Search,
  Globe,
  LayoutGrid,
  List,
  Copy,
  Check,
  Plus,
  ExternalLink,
  LayoutDashboard,
  FileText,
  MessageSquare,
  ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { PortalListItem } from '@/app/(app)/library/portals/page'

interface PortalBrowserProps {
  portals: PortalListItem[]
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'templates'
type ViewMode = 'grid' | 'list'

const FEATURE_ICONS = [
  { key: 'dashboard_enabled', icon: LayoutDashboard, label: 'Dashboard' },
  { key: 'documents_enabled', icon: FileText, label: 'Documents' },
  { key: 'requests_enabled', icon: MessageSquare, label: 'Requests' },
  { key: 'forms_enabled', icon: ClipboardList, label: 'Forms' },
] as const

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'templates', label: 'Templates' },
]

export function PortalBrowser({ portals }: PortalBrowserProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let items = portals
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.client_name.toLowerCase().includes(q)
      )
    }
    if (statusFilter === 'active') items = items.filter((p) => p.is_active && !p.is_template)
    if (statusFilter === 'inactive') items = items.filter((p) => !p.is_active && !p.is_template)
    if (statusFilter === 'templates') items = items.filter((p) => p.is_template)
    return items
  }, [portals, search, statusFilter])

  const handleCopy = useCallback(
    (e: React.MouseEvent, portalId: string, token: string | null) => {
      e.preventDefault()
      e.stopPropagation()
      if (!token) return
      const url = `${window.location.origin}/portal/${token}`
      navigator.clipboard.writeText(url).then(() => {
        setCopiedId(portalId)
        setTimeout(() => setCopiedId(null), 2000)
      })
    },
    []
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search portals..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              aria-pressed={statusFilter === f.value}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            aria-label="Grid view"
            className={`rounded-md p-1.5 ${viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            aria-label="List view"
            className={`rounded-md p-1.5 ${viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <List className="w-4 h-4" />
          </button>

          <Link href="/library/portals/new">
            <Button size="sm" className="ml-2">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Create Portal
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Globe className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {portals.length === 0 ? 'No portals yet' : 'No portals match your filters'}
          </h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm">
            {portals.length === 0
              ? 'Create a client portal to give your clients a self-service hub for documents, forms, and requests.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {portals.length === 0 && (
            <Link href="/library/portals/new">
              <Button size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create Portal
              </Button>
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((portal) => (
            <Link
              key={portal.id}
              href={`/library/portals/${portal.id}`}
              className="group rounded-lg border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {portal.name}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {portal.client_name}
                  </p>
                </div>
                {portal.is_template ? (
                  <Badge variant="outline" className="text-[10px] shrink-0">Template</Badge>
                ) : (
                  <Badge
                    variant={portal.is_active ? 'default' : 'secondary'}
                    className="text-[10px] shrink-0"
                  >
                    {portal.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                )}
              </div>

              {/* Feature icons */}
              <div className="flex items-center gap-2 mb-3">
                {FEATURE_ICONS.map((fi) => {
                  const enabled =
                    portal[fi.key as keyof PortalListItem] as boolean
                  const Icon = fi.icon
                  return (
                    <div
                      key={fi.key}
                      title={`${fi.label}: ${enabled ? 'On' : 'Off'}`}
                      className={`rounded p-1 ${enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground/40'}`}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Updated {new Date(portal.updated_at).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-1">
                  {portal.portal_token && portal.is_active && (
                    <>
                      <button
                        type="button"
                        onClick={(e) =>
                          handleCopy(e, portal.id, portal.portal_token)
                        }
                        className="rounded p-1 hover:bg-muted transition-colors"
                        aria-label={
                          copiedId === portal.id
                            ? 'Copied'
                            : 'Copy portal URL'
                        }
                      >
                        {copiedId === portal.id ? (
                          <Check className="w-3 h-3 text-green-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        )}
                      </button>
                      <a
                        href={`${window.location.origin}/portal/${portal.portal_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded p-1 hover:bg-muted transition-colors"
                        aria-label="Open portal"
                      >
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {filtered.map((portal) => (
            <Link
              key={portal.id}
              href={`/library/portals/${portal.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {portal.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {portal.client_name}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {FEATURE_ICONS.map((fi) => {
                  const enabled =
                    portal[fi.key as keyof PortalListItem] as boolean
                  const Icon = fi.icon
                  return (
                    <Icon
                      key={fi.key}
                      className={`w-3 h-3 ${enabled ? 'text-primary' : 'text-muted-foreground/30'}`}
                    />
                  )
                })}
              </div>
              {portal.is_template ? (
                <Badge variant="outline" className="text-[10px] shrink-0">Template</Badge>
              ) : (
                <Badge
                  variant={portal.is_active ? 'default' : 'secondary'}
                  className="text-[10px] shrink-0"
                >
                  {portal.is_active ? 'Active' : 'Inactive'}
                </Badge>
              )}
              <span className="text-[11px] text-muted-foreground shrink-0 w-24 text-right">
                {new Date(portal.updated_at).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}

    </div>
  )
}
