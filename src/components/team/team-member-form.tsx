'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TeamMemberFormProps {
  /** Existing member data for editing, undefined for creation */
  initialData?: {
    id: string
    name: string
    metadata: {
      email: string | null
      role_title: string | null
      department: string | null
      reporting_to: string | null
      start_date: string | null
      status: string
      clerk_user_id?: string | null
    }
  }
  /** Active team members for reporting-to picker */
  teamMembers: { id: string; name: string }[]
  /** Departments in the org for suggestions */
  departments: string[]
  /** Available RBAC roles for system role assignment */
  roles?: { id: string; name: string; display_name: string; is_system: boolean }[]
  /** Current RBAC role assignment (edit mode only) */
  currentRoleId?: string | null
}

export function TeamMemberForm({ initialData, teamMembers, departments, roles, currentRoleId }: TeamMemberFormProps) {
  const router = useRouter()
  const isEdit = !!initialData

  const [name, setName] = useState(initialData?.name ?? '')
  const [email, setEmail] = useState(initialData?.metadata.email ?? '')
  const [roleTitle, setRoleTitle] = useState(initialData?.metadata.role_title ?? '')
  const [department, setDepartment] = useState(initialData?.metadata.department ?? '')
  const [reportingTo, setReportingTo] = useState(initialData?.metadata.reporting_to ?? '')
  const [startDate, setStartDate] = useState(initialData?.metadata.start_date ?? '')
  const [selectedRoleId, setSelectedRoleId] = useState(currentRoleId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const hasClerkUser = !!initialData?.metadata.clerk_user_id

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const payload: Record<string, unknown> = {
      name,
      ...(email ? { email } : {}),
      ...(roleTitle ? { role_title: roleTitle } : {}),
      ...(department ? { department } : {}),
      ...(reportingTo ? { reporting_to: reportingTo } : {}),
      ...(startDate ? { start_date: startDate } : {}),
    }

    try {
      const url = isEdit ? `/api/team/${initialData.id}` : '/api/team'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error?.message ?? 'Something went wrong')
        return
      }

      // Assign role if changed and member has a linked Clerk user
      const memberId = isEdit ? initialData.id : json.data?.id
      if (memberId && selectedRoleId && selectedRoleId !== (currentRoleId ?? '')) {
        const roleRes = await fetch(`/api/team/${memberId}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role_id: selectedRoleId }),
        })
        if (!roleRes.ok) {
          const roleJson = await roleRes.json()
          setError(roleJson.error?.message ?? 'Team member saved but role assignment failed')
          return
        }
      }

      router.push('/settings/team')
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {error && (
        <div className="rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3 text-[13px] text-destructive" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
          Full Name <span className="text-destructive">*</span>
        </label>
        <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Jane Smith" />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="jane@company.com" />
      </div>

      <div>
        <label htmlFor="role_title" className="block text-sm font-medium text-foreground mb-1">Role / Title</label>
        <input id="role_title" type="text" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className={inputClass} placeholder="Operations Manager" />
      </div>

      <div>
        <label htmlFor="department" className="block text-sm font-medium text-foreground mb-1">Department</label>
        <input id="department" type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} placeholder="Operations" list="dept-suggestions" />
        {departments.length > 0 && (
          <datalist id="dept-suggestions">
            {departments.map((d) => <option key={d} value={d} />)}
          </datalist>
        )}
      </div>

      <div>
        <label htmlFor="reporting_to" className="block text-sm font-medium text-foreground mb-1">Reports To</label>
        <select id="reporting_to" value={reportingTo} onChange={(e) => setReportingTo(e.target.value)} className={inputClass}>
          <option value="">None (top-level)</option>
          {teamMembers
            .filter((m) => m.id !== initialData?.id) // Exclude self
            .map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
        </select>
      </div>

      {roles && roles.length > 0 && (
        <div>
          <label htmlFor="system_role" className="block text-sm font-medium text-foreground mb-1">System Role</label>
          <select
            id="system_role"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className={inputClass}
            disabled={isEdit && !hasClerkUser}
          >
            <option value="">No system role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.display_name}{r.is_system ? ' (System)' : ''}
              </option>
            ))}
          </select>
          {isEdit && !hasClerkUser && (
            <p className="mt-1 text-xs text-muted-foreground">
              Link a Clerk user ID to this member before assigning a system role.
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="start_date" className="block text-sm font-medium text-foreground mb-1">Start Date</label>
        <input id="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Team Member'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
