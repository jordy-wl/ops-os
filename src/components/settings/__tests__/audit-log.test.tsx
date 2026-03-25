/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuditLogTable, type AuditEvent } from '../audit-log-table'
import { AuditLogFilters } from '../audit-log-filters'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'evt-001',
    org_id: 'org-001',
    block_id: 'blk-abcdef12-3456-7890-abcd-ef1234567890',
    type: 'block.created',
    actor_id: 'user_abcdef123456',
    actor_type: 'human',
    payload: { name: 'Thornfield Capital' },
    occurred_at: '2026-03-10T14:30:00.000Z',
    ...overrides,
  }
}

const SAMPLE_EVENTS: AuditEvent[] = [
  makeEvent({ id: 'evt-001', type: 'block.created', occurred_at: '2026-03-10T14:30:00.000Z' }),
  makeEvent({ id: 'evt-002', type: 'block.updated', occurred_at: '2026-03-10T13:00:00.000Z', payload: { changes: { status: 'active' } } }),
  makeEvent({ id: 'evt-003', type: 'workflow.started', occurred_at: '2026-03-09T10:00:00.000Z', payload: {} }),
  makeEvent({ id: 'evt-004', type: 'api_key.revoked', occurred_at: '2026-03-08T09:00:00.000Z', payload: { message: 'Key revoked by admin' } }),
  makeEvent({ id: 'evt-005', type: 'custom.event', occurred_at: '2026-03-07T08:00:00.000Z', payload: {} }),
]

// ---------------------------------------------------------------------------
// AuditLogTable tests
// ---------------------------------------------------------------------------

describe('AuditLogTable', () => {
  const defaultProps = {
    events: SAMPLE_EVENTS,
    isLoading: false,
    hasMore: false,
    onLoadMore: vi.fn(),
    isLoadingMore: false,
  }

  it('renders a table with event rows', () => {
    render(<AuditLogTable {...defaultProps} />)

    // Should render all 5 rows
    const rows = screen.getAllByRole('row')
    // 1 header row + 5 data rows
    expect(rows.length).toBe(6)
  })

  it('renders column headers', () => {
    render(<AuditLogTable {...defaultProps} />)

    expect(screen.getByText('Timestamp')).toBeDefined()
    expect(screen.getByText('Actor')).toBeDefined()
    expect(screen.getByText('Event Type')).toBeDefined()
    expect(screen.getByText('Block')).toBeDefined()
    expect(screen.getByText('Summary')).toBeDefined()
  })

  it('displays event type as a badge with correct label', () => {
    render(<AuditLogTable {...defaultProps} />)

    // Known types get friendly labels
    expect(screen.getByText('Created')).toBeDefined()
    expect(screen.getByText('Updated')).toBeDefined()
    expect(screen.getByText('Workflow Started')).toBeDefined()
    expect(screen.getByText('Key Revoked')).toBeDefined()

    // Unknown type shows the raw string
    expect(screen.getByText('custom.event')).toBeDefined()
  })

  it('renders the empty state when no events', () => {
    render(<AuditLogTable {...defaultProps} events={[]} />)

    expect(screen.getByText('No events found matching your filters.')).toBeDefined()
  })

  it('renders loading skeleton state', () => {
    render(<AuditLogTable {...defaultProps} isLoading={true} />)

    expect(screen.getByRole('status', { name: /loading/i })).toBeDefined()
    // No table should be rendered during loading
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows Load More button when hasMore is true', () => {
    render(<AuditLogTable {...defaultProps} hasMore={true} />)

    const loadMoreBtn = screen.getByRole('button', { name: /load more/i })
    expect(loadMoreBtn).toBeDefined()
  })

  it('does not show Load More button when hasMore is false', () => {
    render(<AuditLogTable {...defaultProps} hasMore={false} />)

    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()
  })

  it('calls onLoadMore when Load More is clicked', () => {
    const onLoadMore = vi.fn()
    render(<AuditLogTable {...defaultProps} hasMore={true} onLoadMore={onLoadMore} />)

    fireEvent.click(screen.getByRole('button', { name: /load more/i }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('disables Load More button while loading more', () => {
    render(<AuditLogTable {...defaultProps} hasMore={true} isLoadingMore={true} />)

    const btn = screen.getByRole('button', { name: /loading/i })
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('extracts summary from payload', () => {
    const events = [
      makeEvent({ id: 'evt-sum-1', payload: { name: 'Thornfield Capital' } }),
    ]
    render(<AuditLogTable {...defaultProps} events={events} />)

    expect(screen.getByText('Thornfield Capital')).toBeDefined()
  })

  it('shows changes summary from payload', () => {
    const events = [
      makeEvent({ id: 'evt-sum-2', payload: { changes: { status: 'active', priority: 'high' } } }),
    ]
    render(<AuditLogTable {...defaultProps} events={events} />)

    expect(screen.getByText('Changed: status, priority')).toBeDefined()
  })

  it('truncates long actor IDs', () => {
    const events = [
      makeEvent({ id: 'evt-actor', actor_id: 'user_abcdef123456789012345' }),
    ]
    render(<AuditLogTable {...defaultProps} events={events} />)

    // Actor ID should be truncated with ellipsis
    expect(screen.getByText('user_abcdef1...')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// AuditLogFilters tests
// ---------------------------------------------------------------------------

describe('AuditLogFilters', () => {
  const defaultFilterProps = {
    selectedTypes: [] as string[],
    fromDate: '',
    toDate: '',
    blockSearch: '',
    onTypesChange: vi.fn(),
    onFromDateChange: vi.fn(),
    onToDateChange: vi.fn(),
    onBlockSearchChange: vi.fn(),
    onClearFilters: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders filter controls', () => {
    render(<AuditLogFilters {...defaultFilterProps} />)

    // Event type checkboxes
    expect(screen.getByText('Block Created')).toBeDefined()
    expect(screen.getByText('Block Updated')).toBeDefined()
    expect(screen.getByText('Workflow Started')).toBeDefined()
    expect(screen.getByText('Key Revoked')).toBeDefined()

    // Date inputs
    expect(screen.getByLabelText('From date')).toBeDefined()
    expect(screen.getByLabelText('To date')).toBeDefined()

    // Block search
    expect(screen.getByPlaceholderText('Search by block ID...')).toBeDefined()

    // Clear button
    expect(screen.getByRole('button', { name: /clear all filters/i })).toBeDefined()
  })

  it('calls onTypesChange when a type checkbox is toggled', () => {
    const onTypesChange = vi.fn()
    render(<AuditLogFilters {...defaultFilterProps} onTypesChange={onTypesChange} />)

    fireEvent.click(screen.getByText('Block Created'))
    expect(onTypesChange).toHaveBeenCalledWith(['block.created'])
  })

  it('removes type when checkbox is unchecked', () => {
    const onTypesChange = vi.fn()
    render(
      <AuditLogFilters
        {...defaultFilterProps}
        selectedTypes={['block.created']}
        onTypesChange={onTypesChange}
      />
    )

    fireEvent.click(screen.getByText('Block Created'))
    expect(onTypesChange).toHaveBeenCalledWith([])
  })

  it('calls onFromDateChange when from date changes', () => {
    const onFromDateChange = vi.fn()
    render(<AuditLogFilters {...defaultFilterProps} onFromDateChange={onFromDateChange} />)

    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-03-01' } })
    expect(onFromDateChange).toHaveBeenCalledWith('2026-03-01')
  })

  it('calls onBlockSearchChange when block search input changes', () => {
    const onBlockSearchChange = vi.fn()
    render(<AuditLogFilters {...defaultFilterProps} onBlockSearchChange={onBlockSearchChange} />)

    fireEvent.change(screen.getByPlaceholderText('Search by block ID...'), {
      target: { value: 'blk-abc' },
    })
    expect(onBlockSearchChange).toHaveBeenCalledWith('blk-abc')
  })

  it('disables clear button when no filters are active', () => {
    render(<AuditLogFilters {...defaultFilterProps} />)

    const clearBtn = screen.getByRole('button', { name: /clear all filters/i })
    expect(clearBtn.hasAttribute('disabled')).toBe(true)
  })

  it('enables clear button when filters are active', () => {
    render(<AuditLogFilters {...defaultFilterProps} selectedTypes={['block.created']} />)

    const clearBtn = screen.getByRole('button', { name: /clear all filters/i })
    expect(clearBtn.hasAttribute('disabled')).toBe(false)
  })

  it('calls onClearFilters when clear button is clicked', () => {
    const onClearFilters = vi.fn()
    render(
      <AuditLogFilters
        {...defaultFilterProps}
        selectedTypes={['block.created']}
        onClearFilters={onClearFilters}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /clear all filters/i }))
    expect(onClearFilters).toHaveBeenCalledTimes(1)
  })

  it('has accessible search landmark', () => {
    render(<AuditLogFilters {...defaultFilterProps} />)

    expect(screen.getByRole('search', { name: /audit log filters/i })).toBeDefined()
  })
})
