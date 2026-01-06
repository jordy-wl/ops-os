import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import InviteUserModal from '@/components/people/InviteUserModal';
import EditUserRoleModal from '@/components/people/EditUserRoleModal';
import CreateTeamModal from '@/components/people/CreateTeamModal';
import CreateDepartmentModal from '@/components/people/CreateDepartmentModal';
import {
  Users,
  Building,
  UserCircle,
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  Shield,
  ChevronRight,
  X,
  Edit,
  UserMinus
} from 'lucide-react';
import { Button } from '@/components/ui/button';

function UserCard({ user, onClick }) {
  const roleColors = {
    admin: 'bg-red-500/20 text-red-400 border-red-500/30',
    workflow_designer: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    manager: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    operator: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const roleLabels = {
    admin: 'Admin',
    workflow_designer: 'Designer',
    manager: 'Manager',
    operator: 'Operator',
    viewer: 'Viewer',
  };

  return (
    <div 
      onClick={onClick}
      className="neumorphic-raised rounded-xl p-4 cursor-pointer transition-all duration-200 hover:translate-y-[-2px] group"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00E5FF] to-[#BD00FF] flex items-center justify-center text-lg font-bold text-[#121212]">
          {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{user.full_name || 'Unnamed User'}</h3>
          <p className="text-sm text-[#A0AEC0] truncate">{user.email}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs border ${roleColors[user.role] || roleColors.operator}`}>
          {roleLabels[user.role] || 'Operator'}
        </span>
      </div>
    </div>
  );
}

function DepartmentCard({ department, teamsCount }) {
  return (
    <div className="neumorphic-raised rounded-xl p-5 cursor-pointer transition-all duration-200 hover:translate-y-[-2px]">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2C2E33] to-[#1A1B1E] flex items-center justify-center">
          <Building className="w-6 h-6 text-[#00E5FF]" />
        </div>
        <button className="p-2 rounded-lg hover:bg-[#3a3d44]">
          <MoreHorizontal className="w-4 h-4 text-[#A0AEC0]" />
        </button>
      </div>
      <h3 className="font-medium text-lg mb-1">{department.name}</h3>
      <p className="text-sm text-[#A0AEC0] mb-3 line-clamp-2">{department.description || 'No description'}</p>
      <div className="flex items-center gap-4 text-xs text-[#4A5568]">
        <span>{teamsCount} teams</span>
        <span>•</span>
        <span className={department.is_active !== false ? 'text-green-400' : 'text-red-400'}>
          {department.is_active !== false ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  );
}

function TeamCard({ team }) {
  return (
    <div className="neumorphic-raised rounded-xl p-4 cursor-pointer transition-all duration-200 hover:translate-y-[-2px]">
      <div className="flex items-center gap-3 mb-3">
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: team.color || '#00E5FF' }}
        />
        <h3 className="font-medium">{team.name}</h3>
      </div>
      <p className="text-sm text-[#A0AEC0] line-clamp-2 mb-3">{team.description || 'No description'}</p>
      <div className="flex items-center gap-2 text-xs text-[#4A5568]">
        <Users className="w-3 h-3" />
        <span>0 members</span>
      </div>
    </div>
  );
}

export default function People() {
  const [activeView, setActiveView] = useState('directory'); // directory, departments, teams
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateDepartment, setShowCreateDepartment] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 100),
  });

  const { data: departments = [], isLoading: deptsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('-created_date', 50),
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list('-created_date', 50),
  });

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">People</h1>
          <p className="text-[#A0AEC0]">
            {users.length} users • {departments.length} departments • {teams.length} teams
          </p>
        </div>
        
        <Button 
          onClick={() => setShowInviteModal(true)}
          className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Invite User
        </Button>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-4 mb-6">
        <div className="neumorphic-pressed rounded-lg p-1 flex">
          <button
            onClick={() => setActiveView('directory')}
            className={`px-4 py-2 rounded-md text-sm transition-all ${
              activeView === 'directory' 
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <UserCircle className="w-4 h-4 inline mr-2" />
            Directory
          </button>
          <button
            onClick={() => setActiveView('departments')}
            className={`px-4 py-2 rounded-md text-sm transition-all ${
              activeView === 'departments' 
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <Building className="w-4 h-4 inline mr-2" />
            Departments
          </button>
          <button
            onClick={() => setActiveView('teams')}
            className={`px-4 py-2 rounded-md text-sm transition-all ${
              activeView === 'teams' 
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Teams
          </button>
        </div>

        {activeView === 'directory' && (
          <div className="flex-1 max-w-md neumorphic-pressed rounded-lg px-4 py-2 flex items-center gap-3">
            <Search className="w-4 h-4 text-[#A0AEC0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="bg-transparent flex-1 focus:outline-none placeholder-[#4A5568]"
            />
          </div>
        )}
      </div>

      {/* Content */}
      {activeView === 'directory' && (
        usersLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-24 bg-[#2C2E33] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="neumorphic-pressed rounded-xl p-12 text-center">
            <Users className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
            <h3 className="font-medium mb-2">No Users Found</h3>
            <p className="text-[#A0AEC0]">
              {searchQuery ? 'Try a different search term.' : 'Invite team members to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filteredUsers.map(user => (
              <UserCard key={user.id} user={user} onClick={() => setSelectedUser(user)} />
            ))}
          </div>
        )
      )}

      {activeView === 'departments' && (
        <>
          <div className="flex justify-end mb-4">
            <Button 
              onClick={() => setShowCreateDepartment(true)}
              className="bg-gradient-to-r from-[#BD00FF] to-[#8B00CC] text-white hover:shadow-lg hover:shadow-[#BD00FF]/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Department
            </Button>
          </div>
          {deptsLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-48 bg-[#2C2E33] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="neumorphic-pressed rounded-xl p-12 text-center">
              <Building className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
              <h3 className="font-medium mb-2">No Departments</h3>
              <p className="text-[#A0AEC0] mb-4">Create departments to organize your teams.</p>
              <Button 
                onClick={() => setShowCreateDepartment(true)}
                className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
              >
                Create Department
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {departments.map(dept => (
                <DepartmentCard 
                  key={dept.id} 
                  department={dept} 
                  teamsCount={teams.filter(t => t.department_id === dept.id).length}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeView === 'teams' && (
        <>
          <div className="flex justify-end mb-4">
            <Button 
              onClick={() => setShowCreateTeam(true)}
              className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Team
            </Button>
          </div>
          {teamsLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-32 bg-[#2C2E33] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div className="neumorphic-pressed rounded-xl p-12 text-center">
              <Users className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
              <h3 className="font-medium mb-2">No Teams</h3>
              <p className="text-[#A0AEC0] mb-4">Create teams to route tasks and workflows.</p>
              <Button 
                onClick={() => setShowCreateTeam(true)}
                className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
              >
                Create Team
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {teams.map(team => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          )}
        </>
      )}

      {/* User Profile Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedUser(null)}
          />
          <div className="w-[450px] glass h-full overflow-y-auto shadow-2xl p-6">
            <div className="flex justify-end mb-4">
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-lg hover:bg-[#2C2E33]"
              >
                <X className="w-5 h-5 text-[#A0AEC0]" />
              </button>
            </div>

            {/* Avatar */}
            <div className="text-center mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00E5FF] to-[#BD00FF] flex items-center justify-center text-3xl font-bold text-[#121212] mx-auto mb-4 ring-4 ring-[#00E5FF]/20">
                {selectedUser.full_name?.charAt(0) || selectedUser.email?.charAt(0) || 'U'}
              </div>
              <h2 className="text-xl font-semibold mb-1">{selectedUser.full_name || 'Unnamed User'}</h2>
              <p className="text-[#A0AEC0]">{selectedUser.role || 'user'}</p>
            </div>

            {/* Info */}
            <div className="space-y-4">
              <div className="neumorphic-pressed rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-[#A0AEC0]" />
                  <div>
                    <p className="text-xs text-[#4A5568] mb-1">Email</p>
                    <p className="font-mono text-sm">{selectedUser.email}</p>
                  </div>
                </div>
              </div>

              <div className="neumorphic-pressed rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-[#A0AEC0]" />
                  <div>
                    <p className="text-xs text-[#4A5568] mb-1">Role</p>
                    <p className="capitalize">{selectedUser.role || 'User'}</p>
                  </div>
                </div>
              </div>

              <div className="neumorphic-pressed rounded-xl p-4">
                <p className="text-xs text-[#4A5568] mb-1">User ID</p>
                <p className="font-mono text-xs text-[#A0AEC0] break-all">{selectedUser.id}</p>
              </div>
            </div>

            {/* Actions */}
            {currentUser?.role === 'admin' && currentUser?.id !== selectedUser.id && (
              <div className="space-y-3 pt-4">
                <Button
                  onClick={() => {
                    setEditingUser(selectedUser);
                    setSelectedUser(null);
                  }}
                  variant="outline"
                  className="w-full bg-transparent border-[#2C2E33] hover:bg-[#2C2E33] flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Role
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <InviteUserModal 
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        currentUserRole={currentUser?.role}
      />
      <EditUserRoleModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        user={editingUser}
        currentUserRole={currentUser?.role}
      />
      <CreateTeamModal 
        isOpen={showCreateTeam}
        onClose={() => setShowCreateTeam(false)}
      />
      <CreateDepartmentModal 
        isOpen={showCreateDepartment}
        onClose={() => setShowCreateDepartment(false)}
      />
    </div>
  );
}