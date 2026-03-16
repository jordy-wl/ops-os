import Link from 'next/link'
import { BlockTypeBadge } from '@/lib/ui/block-type-badge'
import type { Block } from '@/lib/context-assembly'

interface ConnectedBlocksPanelProps {
  neighbours: Block[]
}

/**
 * ConnectedBlocksPanel — displays blocks directly connected to the current block
 * via edges. Each entry shows the type badge and name, linking to the block detail page.
 *
 * @param neighbours - Array of directly connected blocks (one hop)
 */
export function ConnectedBlocksPanel({ neighbours }: ConnectedBlocksPanelProps) {
  return (
    <section aria-label="Connected blocks">
      <h2 className="text-title text-foreground mb-3">Connected to</h2>

      {neighbours.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">(none)</p>
      ) : (
        <ul className="space-y-2" role="list">
          {neighbours.map((block) => (
            <li key={block.id}>
              <Link
                href={`/blocks/${block.id}`}
                className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-[13px] hover:border-foreground/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BlockTypeBadge type={block.type} className="shrink-0" />
                <span className="text-foreground truncate">{block.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
