export const metadata = { title: 'API Keys — Settings — Ops OS' }

/**
 * API key management — placeholder page.
 * Will be populated after BE-02 completes the API key management backend.
 */
export default function ApiKeysSettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate and manage API keys for external integrations.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          API key management will be available here.
        </p>
      </div>
    </div>
  )
}
