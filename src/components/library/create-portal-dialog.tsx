'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Search, Check } from 'lucide-react'

interface ClientOption {
  id: string
  name: string
}

interface CreatePortalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePortalDialog({ open, onOpenChange }: CreatePortalDialogProps) {
  const router = useRouter()
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [portalName, setPortalName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch client blocks when dialog opens
  useEffect(() => {
    if (!open) return
    setLoadingClients(true)
    setError(null)
    setSelectedClientId(null)
    setPortalName('')
    setClientSearch('')

    fetch('/api/blocks?type=client&limit=200')
      .then((r) => r.json())
      .then((data) => {
        const blocks = Array.isArray(data) ? data : data.data ?? []
        setClients(
          blocks.map((b: Record<string, unknown>) => ({
            id: b.id as string,
            name: b.name as string,
          }))
        )
      })
      .catch(() => setError('Failed to load clients'))
      .finally(() => setLoadingClients(false))
  }, [open])

  const handleClientSelect = useCallback(
    (clientId: string, clientName: string) => {
      setSelectedClientId(clientId)
      setPortalName(`${clientName} Portal`)
      setError(null)
    },
    []
  )

  const handleCreate = useCallback(async () => {
    if (!selectedClientId || !portalName.trim()) return
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/portal-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_block_id: selectedClientId,
          name: portalName.trim(),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          body.error?.message ?? 'Failed to create portal'
        )
      }

      const data = await res.json()
      const config = data.data ?? data
      onOpenChange(false)
      router.push(`/library/portals/${config.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }, [selectedClientId, portalName, onOpenChange, router])

  const filteredClients = clientSearch.trim()
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase())
      )
    : clients

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Client Portal</DialogTitle>
          <DialogDescription>
            Select a client to create a self-service portal for them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Client
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search clients..."
                className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-md border border-input">
              {loadingClients ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredClients.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {clients.length === 0
                    ? 'No client blocks found. Create a client block first.'
                    : 'No clients match your search.'}
                </p>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() =>
                      handleClientSelect(client.id, client.name)
                    }
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      selectedClientId === client.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    {selectedClientId === client.id && (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{client.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Portal name */}
          {selectedClientId && (
            <div>
              <label
                htmlFor="portal-name"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Portal Name
              </label>
              <input
                id="portal-name"
                type="text"
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedClientId || !portalName.trim() || creating}
          >
            {creating && (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            )}
            Create Portal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
