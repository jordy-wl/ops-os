import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AssignmentUserSelector({ value, onChange }) {
  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
  });

  return (
    <div>
      <label className="block text-xs text-[#A0AEC0] mb-1">Select User</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
          <SelectValue placeholder="Choose user..." />
        </SelectTrigger>
        <SelectContent className="bg-[#2C2E33]">
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.full_name} ({user.email})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AssignmentTeamSelector({ value, onChange }) {
  const { data: teams = [] } = useQuery({
    queryKey: ['teams-list'],
    queryFn: () => base44.entities.Team.filter({ is_active: true }),
  });

  return (
    <div>
      <label className="block text-xs text-[#A0AEC0] mb-1">Select Team</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
          <SelectValue placeholder="Choose team..." />
        </SelectTrigger>
        <SelectContent className="bg-[#2C2E33]">
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AssignmentDepartmentSelector({ value, onChange }) {
  const { data: departments = [] } = useQuery({
    queryKey: ['departments-list'],
    queryFn: () => base44.entities.Department.filter({ is_active: true }),
  });

  return (
    <div>
      <label className="block text-xs text-[#A0AEC0] mb-1">Select Department</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
          <SelectValue placeholder="Choose department..." />
        </SelectTrigger>
        <SelectContent className="bg-[#2C2E33]">
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}