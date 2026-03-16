import { createHash } from 'crypto'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { validateShareToken } from '@/lib/shared-links'
import { PublicFormPage } from '@/components/public/public-form-page'

interface PublicTokenPageProps {
  params: Promise<{ token: string }>
}

export default async function PublicTokenPage({ params }: PublicTokenPageProps) {
  const { token } = await params

  // Validate the share token
  const result = await validateShareToken(token)

  if (!result.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Link Unavailable</h1>
          <p className="text-muted-foreground">
            {result.reason === 'Link has expired'
              ? 'This link has expired. Please contact the sender for a new link.'
              : 'This link is no longer available.'}
          </p>
        </div>
      </div>
    )
  }

  const { link } = result
  const supabase = createServerClient()

  // Fetch the source block
  const { data: block } = await supabase
    .from('blocks')
    .select('id, name, type, metadata')
    .eq('id', link.block_id)
    .eq('org_id', link.org_id)
    .single()

  if (!block) return notFound()

  // Fetch org branding (brand_kit block)
  const { data: brandKit } = await supabase
    .from('blocks')
    .select('id, metadata')
    .eq('org_id', link.org_id)
    .eq('type', 'brand_kit')
    .maybeSingle()

  // Fetch org name
  const { data: org } = await supabase
    .from('orgs')
    .select('name')
    .eq('id', link.org_id)
    .single()

  const branding = (brandKit?.metadata ?? {}) as Record<string, unknown>

  // Compute document hash for sign-type links
  const documentHash = link.share_type === 'sign'
    ? createHash('sha256').update(JSON.stringify({
        block_id: block.id,
        block_name: block.name,
        metadata: block.metadata,
        link_id: link.id,
      })).digest('hex')
    : undefined

  return (
    <PublicFormPage
      link={{
        id: link.id,
        token: link.token,
        shareType: link.share_type,
        formSchema: link.form_schema,
        blockId: link.block_id,
        orgId: link.org_id,
      }}
      block={{
        id: block.id,
        name: block.name,
        type: block.type,
      }}
      branding={{
        companyName: (branding.company_name as string) ?? org?.name ?? 'Organization',
        logoUrl: (branding.logo_url as string) ?? null,
        primaryColor: (branding.primary_color as string) ?? '#6366f1',
        secondaryColor: (branding.secondary_color as string) ?? null,
        fontFamily: (branding.font_family as string) ?? null,
      }}
      documentHash={documentHash}
    />
  )
}
