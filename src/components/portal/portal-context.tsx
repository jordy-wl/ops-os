'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

export interface PortalConfigData {
  id: string
  org_id: string
  client_block_id: string
  name: string
  dashboard_enabled: boolean
  documents_enabled: boolean
  requests_enabled: boolean
  forms_enabled: boolean
  exposed_block_types: string[]
  exposed_block_ids: string[] | null
  branding_overrides: Record<string, unknown> | null
  is_active: boolean
}

export interface PortalBrandingData {
  org_name: string
  logo_url?: string
  primary_color?: string
}

export interface PortalClientBlock {
  id: string
  name: string
  type: string
  status: string
  metadata: Record<string, unknown> | null
  [key: string]: unknown
}

interface PortalContextValue {
  portalConfig: PortalConfigData
  clientBlock: PortalClientBlock
  branding: PortalBrandingData | null
  token: string
}

const PortalContext = createContext<PortalContextValue | null>(null)

interface PortalProviderProps {
  portalConfig: PortalConfigData
  clientBlock: PortalClientBlock
  branding: PortalBrandingData | null
  token: string
  children: ReactNode
}

export function PortalProvider({
  portalConfig,
  clientBlock,
  branding,
  token,
  children,
}: PortalProviderProps) {
  return (
    <PortalContext.Provider value={{ portalConfig, clientBlock, branding, token }}>
      {children}
    </PortalContext.Provider>
  )
}

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext)
  if (!ctx) {
    throw new Error('usePortal must be used within a PortalProvider')
  }
  return ctx
}
