import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Home,
  Library,
  ListMusic,
  Mic,
  Search,
  Settings,
} from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';

export type NavTab = 'home' | 'library' | 'revision' | 'favourites' | 'settings' | 'record';

interface SidebarProps {
  activeTab: NavTab;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate: (tab: NavTab) => void;
  onOpenSearch: () => void;
}

const NAV_ITEMS: { id: NavTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'library', label: 'Library', Icon: Library },
  { id: 'revision', label: 'Revision', Icon: ListMusic },
  { id: 'favourites', label: 'Favourites', Icon: Heart },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  collapsed,
  onToggleCollapse,
  onNavigate,
  onOpenSearch,
}) => {
  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] transition-[width] duration-200 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Brand Row */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200/80 dark:border-slate-800/80">
        {!collapsed && (
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <img src="/icon.svg" alt="" className="h-7 w-7 rounded-lg shrink-0" />
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              Recallio
            </span>
          </button>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="mx-auto focus:outline-none"
            aria-label="Recallio Home"
          >
            <img src="/icon.svg" alt="" className="h-7 w-7 rounded-lg" />
          </button>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center pt-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Primary Quick Record Action */}
      <div className="p-3 space-y-2">
        <button
          type="button"
          onClick={() => onNavigate('record')}
          className={`w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl font-medium text-sm transition-colors ${
            activeTab === 'record'
              ? 'bg-rose-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white'
          }`}
          title="Quick Record (R)"
        >
          <Mic className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Quick Record</span>}
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full min-h-[40px] flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3 text-xs text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          title="Search (Ctrl/Cmd + K)"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Search</span>}
          </span>
          {!collapsed && <kbd className="font-mono text-[10px] opacity-75">⌘K</kbd>}
        </button>
      </div>

      {/* Main Nav Links */}
      <nav className="flex-1 px-3 py-2 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`w-full min-h-[42px] flex items-center gap-3 px-3 rounded-xl text-sm font-medium transition-colors ${
                collapsed ? 'justify-center' : ''
              } ${
                active
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* PWA Install Prompt */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80">
          <PWAInstallButton variant="sidebar" />
        </div>
      )}
    </aside>
  );
};
