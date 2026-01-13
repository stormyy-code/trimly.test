
import { Compass, Calendar, User as UserIcon, Settings, BarChart3, Scissors, LogOut, Clock, Trophy, RefreshCcw } from 'lucide-react';
import { UserRole } from '../types';
import { translations, Language } from '../translations';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../store/mockDatabase';

interface LayoutProps {
  children: React.ReactNode;
  role: UserRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  title: string;
  lang: Language;
  hideShell?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, role, activeTab, onTabChange, onLogout, title, lang, hideShell = false }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>(new Date().toLocaleTimeString());
  const [tick, setTick] = useState(0); 
  const t = translations[lang];

  const hasNotifications = useMemo(() => {
    if (role === 'customer') {
      const user = db.getActiveUser();
      if (!user) return false;
      const bookings = db.getBookingsSync().filter(b => b.customerId === user.id && b.status === 'completed');
      const reviews = db.getReviewsSync();
      return bookings.some(b => !reviews.some(r => r.bookingId === b.id));
    }
    
    if (role === 'admin') {
      return db.getBarbersSync().some(b => !b.approved);
    }

    return false;
  }, [role, activeTab, tick]);

  useEffect(() => {
    const handleSync = () => {
      setIsSyncing(true);
      setLastSynced(new Date().toLocaleTimeString());
      setTimeout(() => setIsSyncing(false), 1500);
      setTick(prev => prev + 1);
    };

    window.addEventListener('app-sync-start', handleSync);
    window.addEventListener('app-sync-complete', handleSync);
    window.addEventListener('storage', handleSync);
    
    return () => {
      window.removeEventListener('app-sync-start', handleSync);
      window.removeEventListener('app-sync-complete', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const tabs = {
    customer: [
      { id: 'home', icon: Compass, label: t.explore },
      { id: 'leaderboard', icon: Trophy, label: t.ranks },
      { id: 'bookings', icon: Calendar, label: t.bookings, notification: hasNotifications },
      { id: 'profile', icon: UserIcon, label: t.profile },
    ],
    barber: [
      { id: 'home', icon: BarChart3, label: t.stats },
      { id: 'leaderboard', icon: Trophy, label: t.ranks },
      { id: 'schedule', icon: Clock, label: t.schedule },
      { id: 'services', icon: Scissors, label: t.services },
      { id: 'profile', icon: Settings, label: t.settings },
    ],
    admin: [
      { id: 'home', icon: BarChart3, label: t.stats },
      { id: 'leaderboard', icon: Trophy, label: t.ranks },
      { id: 'barbers', icon: Scissors, label: t.barbers },
      { id: 'approvals', icon: Calendar, label: t.approvals, notification: role === 'admin' && hasNotifications },
      { id: 'settings', icon: Settings, label: t.settings },
    ]
  };

  const currentTabs = tabs[role];

  return (
    <div className="flex flex-col h-screen bg-black max-w-md mx-auto relative overflow-hidden shadow-2xl border-x border-white/5">
      {!hideShell && (
        <header className="shrink-0 z-50 bg-black/80 premium-blur border-b border-white/5 px-6 py-5 flex justify-between items-center animate-lux-fade">
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-white tracking-widest uppercase italic">{title}</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <div className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-blue-400 animate-ping' : 'bg-emerald-400'}`}></div>
              <span className="text-[6px] font-black text-zinc-500 uppercase tracking-widest">
                {isSyncing ? 'Sinkronizacija...' : `Zadnje ažuriranje: ${lastSynced}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.dispatchEvent(new Event('app-sync-start'))}
              className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 transition-all active:scale-90 ${isSyncing ? 'animate-spin text-[#D4AF37]' : ''}`}
            >
              <RefreshCcw size={16} />
            </button>
            <button 
              onClick={() => {
                if(confirm(lang === 'hr' ? 'Želite li se stvarno odjaviti?' : 'Are you sure you want to logout?')) onLogout();
              }}
              className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 transition-all active:scale-90 active:bg-red-500 active:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
      )}

      <main className={`flex-1 overflow-y-auto ${!hideShell ? 'pb-32 px-6 pt-6' : ''} animate-lux-fade scrollbar-hide`}>
        {children}
      </main>

      {!hideShell && (
        <nav className="fixed bottom-8 left-8 right-8 max-w-[calc(448px-4rem)] mx-auto bg-zinc-900/90 premium-blur rounded-3xl border border-white/10 flex justify-around items-center px-2 py-2 safe-area-bottom z-50 ios-shadow animate-slide-up">
          {currentTabs.map((tab: any) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl transition-all relative ${
                  isActive ? 'text-[#D4AF37] bg-white/5' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <div className="relative">
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  {tab.notification && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-zinc-900 animate-pulse"></span>
                  )}
                </div>
                <span className={`text-[7px] font-black uppercase tracking-[0.1em] ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};

export default Layout;
