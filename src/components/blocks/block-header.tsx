import { cn } from '@/lib/utils'
import type { Block } from '@/lib/context-assembly'

interface BlockHeaderProps {
  block: Block
}

const TYPE_STYLES: Record<string, string> = {
  client:   'bg-blue-100 text-blue-800',
  deal:     'bg-green-100 text-green-800',
  project:  'bg-yellow-100 text-yellow-800',
  contract: 'bg-purple-100 text-purple-800',
  contact:  'bg-gray-100 text-gray-800',
}

/**
 * BlockHeader — displays the block type badge, name, jurisdiction tag,
 * and current state. Used at the top of the Block Detail page.
 *
 * @param block - The block to display header information for
 */
export function BlockHeader({ block }: BlockHeaderProps) {
  const typeStyle = TYPE_STYLES[block.type] ?? 'bg-gray-100 text-gray-800'
  const jurisdiction = block.metadata?.jurisdiction as string | undefined

  return (
    <div className="flex flex-wrap items-start gap-3">
      {/* Type badge */}
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize shrink-0 mt-1',
          typeStyle
        )}
      >
        {block.type}
      </span>

      <div className="flex-1 min-w-0">
        {/* Block name */}
        <h1 className="text-2xl font-semibold text-foreground truncate">{block.name}</h1>

        {/* Jurisdiction tag + state */}
        <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
          {jurisdiction && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {jurisdiction}
            </span>
          )}
          <span className="capitalize">{block.state}</span>
          <span className="text-muted-foreground" aria-hidden="true">·</span>
          <span>
            Updated{' '}
            <time dateTime={block.updated_at}>
              {new Date(block.updated_at).toLocaleDateString()}
            </time>
          </span>
        </div>
      </div>
    </div>
  )
}
