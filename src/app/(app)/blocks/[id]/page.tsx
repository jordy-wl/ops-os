import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { resolvePermissions } from '@/lib/rbac/resolve'
import { BlockHeader } from '@/components/blocks/block-header'
import { BlockDataPanel } from '@/components/blocks/block-data-panel'
import { EventTimeline } from '@/components/blocks/event-timeline'
import { ConnectedBlocksPanel } from '@/components/blocks/connected-blocks-panel'
import { ActionMenu } from '@/components/actions/action-menu'
import { BlockDocumentsSection } from '@/components/documents/block-documents-section'
import { InsightsPanel } from '@/components/blocks/insights-panel'
import { InlineFieldManagerWrapper } from '@/components/blocks/inline-field-manager-wrapper'
import type { Block, Event } from '@/lib/context-assembly'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BlockDetailPage({ params }: Props) {
  const { id } = await params
  const { userId, orgId } = await auth()

  // Auth guard (belt-and-suspenders — layout + middleware already handle this)
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)

  if (!internalOrgId) redirect('/org-setup')

  const supabase = createServerClient()

  // Fetch block scoped to this org
  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', id)
    .eq('org_id', internalOrgId)
    .single()

  if (blockError?.code === 'PGRST116' || !block) {
    // Distinguish 404 vs 403: check if block exists in any org
    const { data: existsElsewhere } = await supabase
      .from('blocks')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (existsElsewhere) {
      // Block exists but belongs to a different org → 403
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <p className="text-4xl font-bold text-muted-foreground mb-4" aria-hidden="true">403</p>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            You don&apos;t have access to this block
          </h1>
          <p className="text-[13px] text-muted-foreground mb-6">
            This block belongs to a different organisation.
          </p>
          <Link
            href="/blocks"
            className="text-[13px] font-medium text-foreground underline hover:no-underline"
          >
            ← Back to blocks
          </Link>
        </div>
      )
    }

    // Block doesn't exist anywhere → 404
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <p className="text-4xl font-bold text-muted-foreground mb-4" aria-hidden="true">404</p>
        <h1 className="text-xl font-semibold text-foreground mb-2">Block not found</h1>
        <p className="text-[13px] text-muted-foreground mb-6">
          This block may have been deleted or the link is incorrect.
        </p>
        <Link
          href="/blocks"
          className="text-[13px] font-medium text-foreground underline hover:no-underline"
        >
          ← Back to blocks
        </Link>
      </div>
    )
  }

  // Fetch block type definition for structured display + inline field manager
  const { data: typeDef } = await supabase
    .from('block_type_definitions')
    .select('id, type_name, display_name, field_schema')
    .eq('org_id', internalOrgId)
    .eq('type_name', block.type)
    .maybeSingle()

  // Resolve user permissions for permission-gated UI (e.g. inline field manager)
  const { permissions } = await resolvePermissions(
    supabase,
    internalOrgId,
    userId,
    'ops-user'
  )
  const canManageSettings = permissions.has('manage_settings')

  // Fetch events (newest first)
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('block_id', id)
    .eq('org_id', internalOrgId)
    .order('occurred_at', { ascending: false })

  // Fetch connected blocks via block_edges (one hop, both directions)
  const { data: edges } = await supabase
    .from('block_edges')
    .select('from_block_id, to_block_id')
    .eq('org_id', internalOrgId)
    .or(`from_block_id.eq.${id},to_block_id.eq.${id}`)

  // Fetch Google connector for action menu
  const { data: googleConnector } = await supabase
    .from('integration_connectors')
    .select('id')
    .eq('org_id', internalOrgId)
    .eq('provider', 'google')
    .eq('status', 'active')
    .maybeSingle()

  let neighbours: Block[] = []
  if (edges && edges.length > 0) {
    const neighbourIds = [
      ...new Set(
        edges
          .flatMap((e: { from_block_id: string; to_block_id: string }) => [
            e.from_block_id,
            e.to_block_id,
          ])
          .filter((bid: string) => bid !== id)
      ),
    ]
    const { data: neighbourBlocks } = await supabase
      .from('blocks')
      .select('*')
      .in('id', neighbourIds)
      .eq('org_id', internalOrgId)
    neighbours = (neighbourBlocks as Block[]) ?? []
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl animate-page-in">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/library/blocks" className="hover:text-foreground transition-colors">Blocks</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground font-medium truncate max-w-[140px] sm:max-w-[200px] md:max-w-[300px]">{block.name}</li>
        </ol>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <BlockHeader block={block as Block} />
        <ActionMenu
          blockId={block.id}
          blockName={block.name}
          blockType={block.type}
          googleConnectorId={googleConnector?.id ?? null}
        />
      </div>

      {/* Two-column layout on desktop: main content left, sidebar right */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <BlockDataPanel
            block={block as Block}
            fieldSchema={typeDef?.field_schema as Record<string, unknown> | undefined}
          />
          <BlockDocumentsSection blockId={block.id} />
          <EventTimeline events={(events ?? []) as Event[]} />
          {canManageSettings && typeDef && typeDef.field_schema && (
            <InlineFieldManagerWrapper
              blockTypeId={typeDef.id as string}
              blockTypeName={(typeDef.display_name as string) ?? block.type}
              blockTypeSlug={typeDef.type_name as string}
              fieldSchema={typeDef.field_schema as Record<string, unknown>}
            />
          )}
        </div>

        <div className="space-y-6">
          {/* AI Insights panel — workflow_instance blocks only */}
          {block.type === 'workflow_instance' && (
            <InsightsPanel blockId={block.id} />
          )}

          <div className="rounded-md border border-border bg-card p-4">
            <ConnectedBlocksPanel neighbours={neighbours} />
          </div>
        </div>
      </div>
    </div>
  )
}
