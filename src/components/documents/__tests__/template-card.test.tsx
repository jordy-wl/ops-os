/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { TemplateCard, type TemplateData } from '../template-card'

const baseTemplate: TemplateData = {
  id: 'tmpl-1',
  name: 'Client Onboarding Proposal',
  metadata: {
    category: 'proposal',
    variables: [
      { name: 'client_name', type: 'string' },
      { name: 'deal_value', type: 'currency' },
      { name: 'start_date', type: 'date' },
    ],
    structure_description: 'A three-section proposal with executive summary, scope, and pricing.',
    reference_file_name: 'onboarding-proposal.docx',
    reference_mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-03-10T14:30:00Z',
}

describe('TemplateCard', () => {
  it('renders template name', () => {
    render(<TemplateCard template={baseTemplate} />)
    expect(screen.getByText('Client Onboarding Proposal')).toBeDefined()
  })

  it('renders category badge', () => {
    render(<TemplateCard template={baseTemplate} />)
    expect(screen.getByText('Proposal')).toBeDefined()
  })

  it('renders structure description', () => {
    render(<TemplateCard template={baseTemplate} />)
    expect(
      screen.getByText(/three-section proposal/)
    ).toBeDefined()
  })

  it('renders variable count and names', () => {
    render(<TemplateCard template={baseTemplate} />)
    expect(
      screen.getByText(/3 variables/)
    ).toBeDefined()
    expect(
      screen.getByText(/client_name/)
    ).toBeDefined()
  })

  it('renders file type label for DOCX', () => {
    render(<TemplateCard template={baseTemplate} />)
    expect(screen.getByText('DOCX')).toBeDefined()
  })

  it('renders date', () => {
    render(<TemplateCard template={baseTemplate} />)
    // Date is formatted via toLocaleDateString — check for year
    expect(
      screen.getByText(/2026/)
    ).toBeDefined()
  })

  it('links to block detail page', () => {
    render(<TemplateCard template={baseTemplate} />)
    const link = screen.getByRole('listitem')
    expect(link.closest('a')?.getAttribute('href')).toBe('/blocks/tmpl-1')
  })

  it('renders fallback category for unknown categories', () => {
    const template = {
      ...baseTemplate,
      metadata: { ...baseTemplate.metadata, category: 'custom' },
    }
    render(<TemplateCard template={template} />)
    expect(screen.getByText('custom')).toBeDefined()
  })

  it('renders with empty metadata gracefully', () => {
    const template = {
      ...baseTemplate,
      metadata: {},
    }
    render(<TemplateCard template={template} />)
    expect(screen.getByText('Client Onboarding Proposal')).toBeDefined()
    expect(screen.getByText('Other')).toBeDefined()
  })

  it('truncates long variable lists with ellipsis', () => {
    const template = {
      ...baseTemplate,
      metadata: {
        ...baseTemplate.metadata,
        variables: [
          { name: 'a' },
          { name: 'b' },
          { name: 'c' },
          { name: 'd' },
          { name: 'e' },
        ],
      },
    }
    render(<TemplateCard template={template} />)
    expect(screen.getByText(/5 variables/)).toBeDefined()
    expect(screen.getByText(/\.\.\./)).toBeDefined()
  })

  it('renders PDF file type label', () => {
    const template = {
      ...baseTemplate,
      metadata: {
        ...baseTemplate.metadata,
        reference_mime_type: 'application/pdf',
      },
    }
    render(<TemplateCard template={template} />)
    expect(screen.getByText('PDF')).toBeDefined()
  })

  it('renders HTML file type label', () => {
    const template = {
      ...baseTemplate,
      metadata: {
        ...baseTemplate.metadata,
        reference_mime_type: 'text/html',
      },
    }
    render(<TemplateCard template={template} />)
    expect(screen.getByText('HTML')).toBeDefined()
  })
})
