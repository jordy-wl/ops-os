'use client'

interface VersionItem {
  id: string
  title: string
  version: number
  format: string
  ai_generated: boolean
  created_by: string
  created_at: string
}

interface VersionHistoryProps {
  versions: VersionItem[]
  currentVersionId: string
  onSelect: (documentId: string) => void
}

export function VersionHistory({
  versions,
  currentVersionId,
  onSelect,
}: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No version history available.
      </p>
    )
  }

  return (
    <div className="space-y-1 max-h-60 overflow-y-auto">
      {versions.map((v) => {
        const isCurrent = v.id === currentVersionId
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            disabled={isCurrent}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
              isCurrent
                ? 'bg-primary/10 text-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>
                v{v.version}
                {v.ai_generated && (
                  <span className="ml-1.5 text-xs text-muted-foreground">(AI)</span>
                )}
              </span>
              <span className="text-xs">
                {new Date(v.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {v.format.toUpperCase()}
              {' \u00b7 '}
              {new Date(v.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </button>
        )
      })}
    </div>
  )
}
