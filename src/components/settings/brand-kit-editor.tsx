'use client'

import { useState, useCallback } from 'react'

type BrandKitData = {
  logo_url: string
  primary_color: string
  secondary_color: string
  font_family: string
  header_style: {
    background_color: string
    text_color: string
    show_logo: boolean
  }
  footer_content: string
  company_name: string
  tagline: string
}

type ExistingBlock = {
  id: string
  name: string
  metadata: Record<string, unknown>
  updated_at: string
}

const DEFAULT_BRAND: BrandKitData = {
  logo_url: '',
  primary_color: '#1a1a2e',
  secondary_color: '#16213e',
  font_family: 'Inter, sans-serif',
  header_style: {
    background_color: '#1a1a2e',
    text_color: '#ffffff',
    show_logo: true,
  },
  footer_content: '',
  company_name: '',
  tagline: '',
}

const FONT_OPTIONS = [
  'Inter, sans-serif',
  'Georgia, serif',
  'Merriweather, serif',
  'Roboto, sans-serif',
  'Open Sans, sans-serif',
  'Lato, sans-serif',
  'Playfair Display, serif',
  'Source Code Pro, monospace',
]

export function BrandKitEditor({
  existingBlock,
}: {
  orgId: string
  existingBlock?: ExistingBlock
}) {
  const initial: BrandKitData = existingBlock?.metadata
    ? { ...DEFAULT_BRAND, ...(existingBlock.metadata as Partial<BrandKitData>) }
    : DEFAULT_BRAND

  const [brand, setBrand] = useState<BrandKitData>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = useCallback(<K extends keyof BrandKitData>(key: K, value: BrandKitData[K]) => {
    setBrand((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const updateHeader = useCallback(<K extends keyof BrandKitData['header_style']>(
    key: K,
    value: BrandKitData['header_style'][K]
  ) => {
    setBrand((prev) => ({
      ...prev,
      header_style: { ...prev.header_style, [key]: value },
    }))
    setSaved(false)
  }, [])

  const handleSave = useCallback(async () => {
    if (!brand.company_name.trim()) {
      setError('Company name is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const method = existingBlock ? 'PATCH' : 'POST'
      const url = existingBlock
        ? `/api/blocks/${existingBlock.id}`
        : '/api/actions/block.create'

      const body = existingBlock
        ? { metadata: brand }
        : {
            type: 'brand_kit',
            name: `${brand.company_name} Brand Kit`,
            metadata: brand,
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message ?? `Save failed (${res.status})`)
      }

      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [brand, existingBlock])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Brand Kit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your organisation&apos;s brand identity for generated documents.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Brand Kit'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3 text-[13px] text-destructive" role="alert">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Company Info */}
        <section>
          <h2 className="text-lg font-medium text-foreground mb-4">Company Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="company-name" className="block text-sm font-medium text-foreground mb-1">
                Company Name *
              </label>
              <input
                id="company-name"
                type="text"
                value={brand.company_name}
                onChange={(e) => update('company_name', e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your Company Name"
              />
            </div>
            <div>
              <label htmlFor="tagline" className="block text-sm font-medium text-foreground mb-1">
                Tagline
              </label>
              <input
                id="tagline"
                type="text"
                value={brand.tagline}
                onChange={(e) => update('tagline', e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your company tagline"
              />
            </div>
          </div>
        </section>

        {/* Logo */}
        <section>
          <h2 className="text-lg font-medium text-foreground mb-4">Logo</h2>
          <div>
            <label htmlFor="logo-url" className="block text-sm font-medium text-foreground mb-1">
              Logo URL
            </label>
            <input
              id="logo-url"
              type="url"
              value={brand.logo_url}
              onChange={(e) => update('logo_url', e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://example.com/logo.png"
            />
            {brand.logo_url && (
              <div className="mt-3 p-4 bg-muted rounded-md inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brand.logo_url}
                  alt="Logo preview"
                  className="max-h-12 w-auto"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}
          </div>
        </section>

        {/* Colors */}
        <section>
          <h2 className="text-lg font-medium text-foreground mb-4">Brand Colours</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="primary-color" className="block text-sm font-medium text-foreground mb-1">
                Primary Colour
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="primary-color"
                  type="color"
                  value={brand.primary_color}
                  onChange={(e) => update('primary_color', e.target.value)}
                  className="w-10 h-10 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={brand.primary_color}
                  onChange={(e) => update('primary_color', e.target.value)}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-sm font-mono"
                  placeholder="#1a1a2e"
                />
              </div>
            </div>
            <div>
              <label htmlFor="secondary-color" className="block text-sm font-medium text-foreground mb-1">
                Secondary Colour
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="secondary-color"
                  type="color"
                  value={brand.secondary_color}
                  onChange={(e) => update('secondary_color', e.target.value)}
                  className="w-10 h-10 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={brand.secondary_color}
                  onChange={(e) => update('secondary_color', e.target.value)}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-sm font-mono"
                  placeholder="#16213e"
                />
              </div>
            </div>
            <div>
              <label htmlFor="header-bg" className="block text-sm font-medium text-foreground mb-1">
                Header Background
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="header-bg"
                  type="color"
                  value={brand.header_style.background_color || brand.primary_color}
                  onChange={(e) => updateHeader('background_color', e.target.value)}
                  className="w-10 h-10 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={brand.header_style.background_color || brand.primary_color}
                  onChange={(e) => updateHeader('background_color', e.target.value)}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="text-lg font-medium text-foreground mb-4">Typography</h2>
          <div>
            <label htmlFor="font-family" className="block text-sm font-medium text-foreground mb-1">
              Font Family
            </label>
            <select
              id="font-family"
              value={brand.font_family}
              onChange={(e) => update('font_family', e.target.value)}
              className="w-full max-w-md rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>
                  {f.split(',')[0]}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Footer */}
        <section>
          <h2 className="text-lg font-medium text-foreground mb-4">Document Footer</h2>
          <div>
            <label htmlFor="footer-content" className="block text-sm font-medium text-foreground mb-1">
              Footer Content (HTML allowed)
            </label>
            <textarea
              id="footer-content"
              value={brand.footer_content}
              onChange={(e) => update('footer_content', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="© 2026 Your Company. All rights reserved. ABN: 12 345 678 901"
            />
          </div>
        </section>

        {/* Live Preview */}
        <section>
          <h2 className="text-lg font-medium text-foreground mb-4">Preview</h2>
          <div className="border border-border rounded-lg overflow-hidden shadow-sm">
            {/* Header Preview */}
            <div
              className="px-6 py-4 flex items-center gap-3"
              style={{
                backgroundColor: brand.header_style.background_color || brand.primary_color,
                color: brand.header_style.text_color || '#ffffff',
              }}
            >
              {brand.header_style.show_logo && brand.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo_url} alt="" className="h-8 w-auto" />
              )}
              <div>
                <div className="font-semibold" style={{ fontFamily: brand.font_family }}>
                  {brand.company_name || 'Company Name'}
                </div>
                {brand.tagline && (
                  <div className="text-xs opacity-80">{brand.tagline}</div>
                )}
              </div>
            </div>
            {/* Body Preview */}
            <div className="p-6" style={{ fontFamily: brand.font_family }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: brand.primary_color }}>
                Sample Document Heading
              </h3>
              <p className="text-sm text-foreground mb-3">
                This is how your generated documents will look with the current brand settings.
                Headings use your primary colour, and links use the secondary colour.
              </p>
              <p className="text-sm">
                <a href="#" style={{ color: brand.secondary_color || brand.primary_color }}>
                  Sample link with secondary colour
                </a>
              </p>
            </div>
            {/* Footer Preview */}
            <div className="border-t px-6 py-3 text-xs text-muted-foreground">
              {brand.footer_content || `© ${new Date().getFullYear()} ${brand.company_name || 'Company Name'}`}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
