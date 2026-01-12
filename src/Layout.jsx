import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import {
  CheckCircle,
  GitMerge,
  Briefcase,
  Users,
  Sparkles,
  BookOpen,
  Package,
  Settings,
  Plus,
  Search,
  Bell,
  Command
} from 'lucide-react';

const navItems = [
  { name: 'MyWork', icon: CheckCircle, label: 'My Work' },
  { name: 'Workflows', icon: GitMerge, label: 'Workflows' },
  { name: 'Clients', icon: Briefcase, label: 'Clients' },
  { name: 'Offerings', icon: Package, label: 'Offerings' },
  { name: 'People', icon: Users, label: 'People' },
  { name: 'Strategy', icon: Sparkles, label: 'Strategy', isAI: true },
  { name: 'Library', icon: BookOpen, label: 'Library' },
  { name: 'KnowledgeLibrary', icon: BookOpen, label: 'Knowledge' },
];

export default function Layout({ children, currentPageName }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#121212] text-[#F5F5F5] flex">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');

        * {
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        :root {
          --bg-base: #121212;
          --bg-surface: #2C2E33;
          --bg-surface-hover: #3a3d44;
          --accent-cyan: #00E5FF;
          --accent-purple: #BD00FF;
          --text-primary: #F5F5F5;
          --text-secondary: #A0AEC0;
          --text-disabled: #4A5568;
        }
        
        .neumorphic-raised {
          background: linear-gradient(145deg, #33363c, #25272b);
          box-shadow: 
            4px 4px 8px #0d0d0d,
            -4px -4px 8px #1f2024;
        }
        
        .neumorphic-pressed {
          background: #1A1B1E;
          box-shadow: 
            inset 4px 4px 8px #0d0d0d,
            inset -4px -4px 8px #272a2f;
        }
        
        .glass {
          background: rgba(44, 46, 51, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .glow-cyan {
          box-shadow: 0 0 20px rgba(0, 229, 255, 0.3);
        }
        
        .glow-purple {
          box-shadow: 0 0 20px rgba(189, 0, 255, 0.3);
        }
        
        .nav-active {
          background: #1A1B1E;
          box-shadow: 
            inset 2px 2px 4px #0d0d0d,
            inset -2px -2px 4px #272a2f;
        }
        
        .scrollbar-dark::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-dark::-webkit-scrollbar-track {
          background: #1A1B1E;
        }
        .scrollbar-dark::-webkit-scrollbar-thumb {
          background: #4A5568;
          border-radius: 3px;
        }
      `}</style>

      {/* Navigation Dock */}
      <nav className="fixed left-0 top-0 h-full w-20 glass z-50 flex flex-col items-center py-6">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E5FF] to-[#BD00FF] flex items-center justify-center font-semibold text-sm">
            OS
          </div>
        </div>

        {/* Nav Items */}
        <div className="flex-1 flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = currentPageName === item.name;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.name)}
                className={`
                  w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200
                  ${isActive ? 'nav-active' : 'hover:bg-[#2C2E33]'}
                  group relative
                `}
              >
                <Icon 
                  className={`w-5 h-5 transition-colors ${
                    isActive 
                      ? item.isAI ? 'text-[#BD00FF]' : 'text-[#00E5FF]'
                      : 'text-[#A0AEC0] group-hover:text-[#F5F5F5]'
                  }`}
                />
                {isActive && (
                  <div className={`absolute inset-0 rounded-xl ${item.isAI ? 'glow-purple' : 'glow-cyan'} opacity-30`} />
                )}
                
                {/* Tooltip */}
                <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-[#2C2E33] text-sm font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Settings */}
        <Link
          to={createPageUrl('Settings')}
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200
            ${currentPageName === 'Settings' ? 'nav-active' : 'hover:bg-[#2C2E33]'}
            group relative
          `}
        >
          <Settings className={`w-5 h-5 ${currentPageName === 'Settings' ? 'text-[#00E5FF]' : 'text-[#A0AEC0] group-hover:text-[#F5F5F5]'}`} />
        </Link>
      </nav>

      {/* Main Content */}
      <div className="flex-1 ml-20">
        {/* Top Command Bar */}
        <header className="fixed top-0 left-20 right-0 h-16 glass z-40 flex items-center justify-between px-6">
          {/* Omnibox */}
          <div className="flex-1 max-w-2xl mx-auto">
            <div className="neumorphic-pressed rounded-full px-4 py-2 flex items-center gap-3">
              <Search className="w-4 h-4 text-[#A0AEC0]" />
              <input
                type="text"
                placeholder="Search clients, workflows, or type '/' for commands..."
                className="bg-transparent flex-1 text-sm focus:outline-none placeholder-[#4A5568]"
              />
              <div className="flex items-center gap-1 text-xs text-[#4A5568]">
                <Command className="w-3 h-3" />
                <span>K</span>
              </div>
            </div>
          </div>

          {/* Right Icons */}
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-[#2C2E33] transition-colors">
              <Bell className="w-5 h-5 text-[#A0AEC0]" />
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
            </button>
            <div className="w-8 h-8 rounded-full neumorphic-raised flex items-center justify-center text-sm font-medium">
              U
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="pt-16 min-h-screen scrollbar-dark">
          {children}
        </main>
      </div>

      {/* Create FAB */}
      <div className="fixed bottom-6 left-6 z-50">
        <div className="relative">
          <button
            onClick={() => setIsCreateOpen(!isCreateOpen)}
            className={`
              w-14 h-14 rounded-full 
              bg-gradient-to-br from-[#00E5FF] to-[#0099ff]
              flex items-center justify-center
              shadow-lg shadow-[#00E5FF]/20
              hover:shadow-xl hover:shadow-[#00E5FF]/30
              transition-all duration-200
              ${isCreateOpen ? 'rotate-45' : ''}
            `}
          >
            <Plus className="w-6 h-6 text-[#121212]" />
          </button>

          {/* Create Menu */}
          {isCreateOpen && (
            <div className="absolute bottom-16 left-0 glass rounded-xl py-2 w-48 shadow-xl">
              <Link 
                to={createPageUrl('Clients') + '?action=create'}
                className="flex items-center gap-3 px-4 py-2 hover:bg-[#3a3d44] transition-colors"
                onClick={() => setIsCreateOpen(false)}
              >
                <Briefcase className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-sm">New Client</span>
              </Link>
              <Link 
                to={createPageUrl('Workflows') + '?action=start'}
                className="flex items-center gap-3 px-4 py-2 hover:bg-[#3a3d44] transition-colors"
                onClick={() => setIsCreateOpen(false)}
              >
                <GitMerge className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-sm">Start Workflow</span>
              </Link>
              <Link 
                to={createPageUrl('MyWork') + '?action=create'}
                className="flex items-center gap-3 px-4 py-2 hover:bg-[#3a3d44] transition-colors"
                onClick={() => setIsCreateOpen(false)}
              >
                <CheckCircle className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-sm">New Task</span>
              </Link>
              <Link 
                to={createPageUrl('People') + '?action=invite'}
                className="flex items-center gap-3 px-4 py-2 hover:bg-[#3a3d44] transition-colors"
                onClick={() => setIsCreateOpen(false)}
              >
                <Users className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-sm">Invite User</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}