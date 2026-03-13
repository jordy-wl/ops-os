'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TeamMember {
  id: string
  name: string
  metadata: {
    email: string | null
    role_title: string | null
    department: string | null
    status: string
    reporting_to: string | null
  }
}

interface TeamMemberListProps {
  members: TeamMember[]
  departments: string[]
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-success/10 text-success',
  on_leave: 'bg-warning/10 text-warning',
  offboarding: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground',
}

export function TeamMemberList({ members, departments }: TeamMemberListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deptFilter, setDeptFilter] = useState<string>('all')

  const filtered = members.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) &&
        !(m.metadata.email ?? '').toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    if (statusFilter !== 'all' && m.metadata.status !== statusFilter) return false
    if (deptFilter !== 'all' && m.metadata.department !== deptFilter) return false
    return true
  })

  return (
    <div>
      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Search team members"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="offboarding">Offboarding</option>
          <option value="inactive">Inactive</option>
        </select>
        {departments.length > 0 && (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Filter by department"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground mb-3">
        {filtered.length} {filtered.length === 1 ? 'member' : 'members'}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium text-foreground mb-1">No team members found</p>
          <p className="text-sm text-muted-foreground">
            {members.length === 0
              ? 'Add your first team member to get started.'
              : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => router.push(`/settings/team/${m.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/settings/team/${m.id}`) }}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      {m.metadata.email && (
                        <p className="text-xs text-muted-foreground">{m.metadata.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                    {m.metadata.role_title ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                    {m.metadata.department ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[m.metadata.status] ?? STATUS_BADGE.active}`}>
                      {m.metadata.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
