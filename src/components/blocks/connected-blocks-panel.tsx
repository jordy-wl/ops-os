import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Block } from '@/lib/context-assembly'

interface ConnectedBlocksPanelProps {
  neighbours: Block[]
}

const TYPE_STYLES: Record<string, string> = {
  client:      'bg-blue-100 text-blue-700',
  deal:        'bg-green-100 text-green-700',
  project:     'bg-yellow-100 text-yellow-700',
  contract:    'bg-purple-100 text-purple-700',
  contact:     'bg-gray-100 text-gray-700',
  solution:    'bg-indigo-100 text-indigo-700',
  product:     'bg-emerald-100 text-emerald-700',
  service:     'bg-violet-100 text-violet-700',
  team_member: 'bg-orange-100 text-orange-700',
  policy:      'bg-red-100 text-red-700',
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
      <h2 className="text-sm font-semibold text-foreground mb-3">Connected to</h2>

      {neighbours.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">(none)</p>
      ) : (
        <ul className="space-y-2" role="list">
          {neighbours.map((block) => {
            const typeStyle = TYPE_STYLES[block.type] ?? 'bg-gray-100 text-gray-700'

            return (
              <li key={block.id}>
                <Link
                  href={`/blocks/${block.id}`}
                  className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize shrink-0',
                      typeStyle
                    )}
                  >
                    {block.type}
                  </span>
                  <span className="text-foreground truncate">{block.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
