import { BlockTypeBadge } from '@/lib/ui/block-type-badge'
import type { Block } from '@/lib/context-assembly'

interface BlockHeaderProps {
  block: Block
}

/**
 * BlockHeader — displays the block type badge, name, jurisdiction tag,
 * and current state. Used at the top of the Block Detail page.
 *
 * @param block - The block to display header information for
 */
export function BlockHeader({ block }: BlockHeaderProps) {
  const jurisdiction = block.metadata?.jurisdiction as string | undefined

  return (
    <div className="flex-1 min-w-0">
      {/* Block name + inline badges */}
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-page font-semibold text-foreground truncate">{block.name}</h1>
        <BlockTypeBadge type={block.type} className="shrink-0" />
        <span className="inline-flex items-center rounded-full bg-muted text-foreground px-2 py-0.5 text-[11px] font-medium capitalize">
          {block.state}
        </span>
      </div>

      {/* Metadata line */}
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        {jurisdiction && (
          <span className="text-[12px]">{jurisdiction}</span>
        )}
        {jurisdiction && <span aria-hidden="true">&middot;</span>}
        <span>
          Updated{' '}
          <time dateTime={block.updated_at}>
            {new Date(block.updated_at).toLocaleDateString()}
          </time>
        </span>
      </div>
    </div>
  )
}
