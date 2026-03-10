import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { PageContainer } from '@/components/shell/page-container'
import { PageHeader } from '@/components/shell/page-header'

export const metadata = { title: 'Block Types — Ops OS' }

interface BlockTypeDefinition {
  id: string
  type_name: string
  display_name: string
  description: string | null
  icon: string
  color: string
  is_system: boolean
  field_schema: {
    type?: string
    properties?: Record<string, Record<string, unknown>>
  } | null
}

/** Map block type icon names to simple emoji/text fallbacks for display. */
function getIconDisplay(icon: string): string {
  const iconMap: Record<string, string> = {
    building: '\u{1F3E2}',
    handshake: '\u{1F91D}',
    folder: '\u{1F4C1}',
    user: '\u{1F464}',
    'file-text': '\u{1F4C4}',
    'git-branch': '\u{1F500}',
    play: '\u25B6',
    'check-square': '\u2611',
    palette: '\u{1F3A8}',
    box: '\u{1F4E6}',
  }
  return iconMap[icon] ?? '\u{1F4E6}'
}

/** Map color names to Tailwind border-color classes. */
function getColorClass(color: string): string {
  const colorMap: Record<string, string> = {
    blue: 'border-l-blue-500',
    green: 'border-l-green-500',
    purple: 'border-l-purple-500',
    gray: 'border-l-gray-400',
    amber: 'border-l-amber-500',
    indigo: 'border-l-indigo-500',
    cyan: 'border-l-cyan-500',
    orange: 'border-l-orange-500',
    rose: 'border-l-rose-500',
  }
  return colorMap[color] ?? 'border-l-gray-400'
}

export default async function BlockTypesPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)
  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  const { data: blockTypes, error } = await supabase
    .from('block_type_definitions')
    .select('id, type_name, display_name, description, icon, color, is_system, field_schema')
    .eq('org_id', internalOrgId)
    .order('type_name', { ascending: true })

  const types: BlockTypeDefinition[] = blockTypes ?? []

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title="Block Types"
        subtitle="Manage fields and properties for each block type."
      />

      {error && (
        <div
          className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          Failed to load block types. Please refresh the page.
        </div>
      )}

      {!error && types.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium text-gray-900 mb-1">No block types found</p>
          <p className="text-sm text-gray-500">
            Block types are automatically created when your organisation is set up.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map((typeDef) => {
          const fieldCount = typeDef.field_schema?.properties
            ? Object.keys(typeDef.field_schema.properties).length
            : 0

          return (
            <Link
              key={typeDef.id}
              href={`/settings/block-types/${typeDef.id}`}
              className={`group block rounded-lg border border-l-4 ${getColorClass(typeDef.color)} bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl" aria-hidden="true">
                  {getIconDisplay(typeDef.icon)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-gray-900 truncate group-hover:text-gray-700">
                    {typeDef.display_name}
                  </h2>
                  {typeDef.is_system && (
                    <span className="inline-block text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      System
                    </span>
                  )}
                </div>
              </div>
              {typeDef.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                  {typeDef.description}
                </p>
              )}
              <div className="text-xs text-gray-400">
                {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
              </div>
            </Link>
          )
        })}
      </div>
    </PageContainer>
  )
}
