import React from 'react';
import { Heart, Home, Library, ListMusic, Settings } from 'lucide-react';
import type { NavTab } from './Sidebar';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
}

const MOBILE_TABS: { id: NavTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'library', label: 'Library', Icon: Library },
  { id: 'revision', label: 'Revision', Icon: ListMusic },
  { id: 'favourites', label: 'Favourites', Icon: Heart },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onNavigate }) => {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md pb-safe"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 h-14 items-center">
        {MOBILE_TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'stroke-[2.2]' : ''}`} />
              <span className="text-[10px] font-medium tracking-tight leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
