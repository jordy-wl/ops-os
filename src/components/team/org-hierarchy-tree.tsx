'use client'

interface OrgNode {
  id: string
  name: string
  slug: string | null
  level: string
  children: OrgNode[]
}

interface OrgHierarchyTreeProps {
  tree: OrgNode | null
}

const LEVEL_BADGE: Record<string, string> = {
  org: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  suborg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  department: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  team: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

function TreeNode({ node, depth }: { node: OrgNode; depth: number }) {
  return (
    <div className={depth > 0 ? 'ml-6 border-l border-border pl-4' : ''}>
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-sm font-medium text-foreground">{node.name}</span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${LEVEL_BADGE[node.level] ?? LEVEL_BADGE.org}`}>
          {node.level}
        </span>
      </div>
      {node.children.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function OrgHierarchyTree({ tree }: OrgHierarchyTreeProps) {
  if (!tree) {
    return (
      <p className="text-sm text-muted-foreground">No org hierarchy data available.</p>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <TreeNode node={tree} depth={0} />
    </div>
  )
}
