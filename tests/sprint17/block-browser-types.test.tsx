/**
 * tests/sprint17/block-browser-types.test.tsx
 *
 * Unit tests for BlockBrowser component type-seeding behavior.
 * Verifies that the type filter pills are seeded from typeDefinitions
 * (showing types with 0 blocks), counts blocks per type correctly,
 * and filters blocks when a type pill is clicked.
 *
 * Uses vitest + @testing-library/react in jsdom environment.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icon = (name: string) =>
    function MockIcon(props: Record<string, unknown>) {
      return React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })
    }
  return {
    Search: icon('search'),
    LayoutGrid: icon('layout-grid'),
    List: icon('list'),
    Box: icon('box'),
  }
})

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: function MockLink({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    [key: string]: unknown
  }) {
    return React.createElement('a', { href, ...props }, children)
  },
}))

import { BlockBrowser } from '@/components/library/block-browser'

// ---- Test Data Factories ---------------------------------------------------

function createBlock(overrides: Partial<{
  id: string
  name: string
  type: string
  state: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}> = {}) {
  return {
    id: overrides.id ?? `block-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? 'Test Block',
    type: overrides.type ?? 'client',
    state: overrides.state ?? 'active',
    metadata: overrides.metadata ?? null,
    created_at: overrides.created_at ?? '2026-03-10T00:00:00Z',
    updated_at: overrides.updated_at ?? '2026-03-12T00:00:00Z',
  }
}

function createTypeDef(overrides: Partial<{
  type_name: string
  label: string | null
  icon: string | null
  color: string | null
  field_schema: Record<string, unknown> | null
}> = {}) {
  return {
    type_name: overrides.type_name ?? 'client',
    label: overrides.label ?? 'Client',
    icon: overrides.icon ?? null,
    color: overrides.color ?? null,
    field_schema: overrides.field_schema ?? null,
  }
}

// ---- Tests -----------------------------------------------------------------

describe('BlockBrowser type seeding', () => {
  it('should show all type definitions in filter pills even with 0 blocks', () => {
    const typeDefinitions = [
      createTypeDef({ type_name: 'client', label: 'Client' }),
      createTypeDef({ type_name: 'deal', label: 'Deal' }),
      createTypeDef({ type_name: 'project', label: 'Project' }),
      createTypeDef({ type_name: 'policy', label: 'Policy' }),
    ]

    render(
      <BlockBrowser blocks={[]} typeDefinitions={typeDefinitions} />
    )

    // The "All" pill should show 0
    expect(screen.getByText('All (0)')).toBeDefined()

    // Each type definition should be visible as a filter pill with (0) count
    expect(screen.getByText('Client (0)')).toBeDefined()
    expect(screen.getByText('Deal (0)')).toBeDefined()
    expect(screen.getByText('Project (0)')).toBeDefined()
    expect(screen.getByText('Policy (0)')).toBeDefined()
  })

  it('should count blocks per type correctly', () => {
    const typeDefinitions = [
      createTypeDef({ type_name: 'client', label: 'Client' }),
      createTypeDef({ type_name: 'deal', label: 'Deal' }),
      createTypeDef({ type_name: 'project', label: 'Project' }),
    ]

    const blocks = [
      createBlock({ name: 'Acme Corp', type: 'client' }),
      createBlock({ name: 'Globex Inc', type: 'client' }),
      createBlock({ name: 'Big Deal', type: 'deal' }),
      // No project blocks
    ]

    render(
      <BlockBrowser blocks={blocks} typeDefinitions={typeDefinitions} />
    )

    // "All" shows total count
    expect(screen.getByText('All (3)')).toBeDefined()

    // Type counts match actual blocks
    expect(screen.getByText('Client (2)')).toBeDefined()
    expect(screen.getByText('Deal (1)')).toBeDefined()
    expect(screen.getByText('Project (0)')).toBeDefined()
  })

  it('should filter blocks by type when a pill is clicked', () => {
    const typeDefinitions = [
      createTypeDef({ type_name: 'client', label: 'Client' }),
      createTypeDef({ type_name: 'deal', label: 'Deal' }),
    ]

    const blocks = [
      createBlock({ name: 'Acme Corp', type: 'client' }),
      createBlock({ name: 'Globex Inc', type: 'client' }),
      createBlock({ name: 'Big Deal', type: 'deal' }),
    ]

    render(
      <BlockBrowser blocks={blocks} typeDefinitions={typeDefinitions} />
    )

    // Initially all blocks are shown
    expect(screen.getByText('Acme Corp')).toBeDefined()
    expect(screen.getByText('Globex Inc')).toBeDefined()
    expect(screen.getByText('Big Deal')).toBeDefined()

    // Click the Deal type pill
    fireEvent.click(screen.getByText('Deal (1)'))

    // Only deal blocks visible
    expect(screen.getByText('Big Deal')).toBeDefined()
    expect(screen.queryByText('Acme Corp')).toBeNull()
    expect(screen.queryByText('Globex Inc')).toBeNull()
  })

  it('should show all blocks when "All" pill is clicked after filtering', () => {
    const typeDefinitions = [
      createTypeDef({ type_name: 'client', label: 'Client' }),
      createTypeDef({ type_name: 'deal', label: 'Deal' }),
    ]

    const blocks = [
      createBlock({ name: 'Acme Corp', type: 'client' }),
      createBlock({ name: 'Big Deal', type: 'deal' }),
    ]

    render(
      <BlockBrowser blocks={blocks} typeDefinitions={typeDefinitions} />
    )

    // Filter to deals only
    fireEvent.click(screen.getByText('Deal (1)'))
    expect(screen.queryByText('Acme Corp')).toBeNull()

    // Click All to restore
    fireEvent.click(screen.getByText('All (2)'))
    expect(screen.getByText('Acme Corp')).toBeDefined()
    expect(screen.getByText('Big Deal')).toBeDefined()
  })

  it('should add types from blocks that have no type definition', () => {
    const typeDefinitions = [
      createTypeDef({ type_name: 'client', label: 'Client' }),
    ]

    // A block with type 'task' that has no type definition
    const blocks = [
      createBlock({ name: 'Acme Corp', type: 'client' }),
      createBlock({ name: 'Do the thing', type: 'task' }),
    ]

    render(
      <BlockBrowser blocks={blocks} typeDefinitions={typeDefinitions} />
    )

    // 'task' should appear as a pill with auto-generated label
    expect(screen.getByText('Task (1)')).toBeDefined()
    expect(screen.getByText('Client (1)')).toBeDefined()
  })

  it('should format unknown type names to title case with underscores replaced', () => {
    const typeDefinitions: Array<{
      type_name: string
      label: string | null
      icon: string | null
      color: string | null
      field_schema: Record<string, unknown> | null
    }> = []

    const blocks = [
      createBlock({ name: 'My Template', type: 'workflow_template' }),
    ]

    render(
      <BlockBrowser blocks={blocks} typeDefinitions={typeDefinitions} />
    )

    // workflow_template becomes "Workflow Template"
    expect(screen.getByText('Workflow Template (1)')).toBeDefined()
  })

  it('should display header with correct block and type counts', () => {
    const typeDefinitions = [
      createTypeDef({ type_name: 'client', label: 'Client' }),
      createTypeDef({ type_name: 'deal', label: 'Deal' }),
    ]

    const blocks = [
      createBlock({ name: 'A', type: 'client' }),
      createBlock({ name: 'B', type: 'client' }),
      createBlock({ name: 'C', type: 'deal' }),
    ]

    render(
      <BlockBrowser blocks={blocks} typeDefinitions={typeDefinitions} />
    )

    expect(screen.getByText('Block Library')).toBeDefined()
    expect(screen.getByText(/3 blocks across 2 types/)).toBeDefined()
  })

  it('should show empty state when no blocks exist', () => {
    render(
      <BlockBrowser blocks={[]} typeDefinitions={[]} />
    )

    expect(screen.getByText('No blocks yet')).toBeDefined()
    expect(screen.getByText('Go to dashboard')).toBeDefined()
  })

  it('should show no-match message when filter yields empty results', () => {
    const typeDefinitions = [
      createTypeDef({ type_name: 'client', label: 'Client' }),
      createTypeDef({ type_name: 'policy', label: 'Policy' }),
    ]

    const blocks = [
      createBlock({ name: 'Acme', type: 'client' }),
    ]

    render(
      <BlockBrowser blocks={blocks} typeDefinitions={typeDefinitions} />
    )

    // Click Policy (0 blocks)
    fireEvent.click(screen.getByText('Policy (0)'))

    expect(screen.getByText(/No blocks match your filter/)).toBeDefined()
    expect(screen.getByText('Clear filters')).toBeDefined()
  })

  it('should filter by search text', () => {
    const typeDefinitions = [
      createTypeDef({ type_name: 'client', label: 'Client' }),
    ]

    const blocks = [
      createBlock({ name: 'Acme Corp', type: 'client' }),
      createBlock({ name: 'Globex Inc', type: 'client' }),
    ]

    render(
      <BlockBrowser blocks={blocks} typeDefinitions={typeDefinitions} />
    )

    const searchInput = screen.getByLabelText('Search blocks by name')
    fireEvent.change(searchInput, { target: { value: 'Acme' } })

    expect(screen.getByText('Acme Corp')).toBeDefined()
    expect(screen.queryByText('Globex Inc')).toBeNull()
  })

  it('should use type definition label instead of auto-generated label', () => {
    const typeDefinitions = [
      createTypeDef({ type_name: 'custom_type', label: 'Custom Display Name' }),
    ]

    const blocks = [
      createBlock({ name: 'Block A', type: 'custom_type' }),
    ]

    render(
      <BlockBrowser blocks={blocks} typeDefinitions={typeDefinitions} />
    )

    // Should use the label from the type definition, not auto-format
    expect(screen.getByText('Custom Display Name (1)')).toBeDefined()
  })
})
