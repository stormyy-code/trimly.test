
import { Compass, Calendar, User as UserIcon, Settings, BarChart3, Scissors, LogOut, Clock, Trophy, RefreshCcw } from 'lucide-react';
import { UserRole } from '../types';
import { translations, Language } from '../translations';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../store/database';

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
    <div className="flex flex-col h-full w-full bg-black relative overflow-hidden">
      {!hideShell && (
        <header className="shrink-0 z-50 bg-black/80 premium-blur border-b border-white/5 px-6 py-5 flex justify-between items-center animate-lux-fade pt-safe">
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-white tracking-widest uppercase italic leading-none">{title}</h1>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`}></div>
              <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest leading-none">
                {isSyncing ? 'Sinkronizacija...' : `${lastSynced}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => window.dispatchEvent(new Event('app-sync-start'))}
              className={`w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 transition-all active:scale-90 ${isSyncing ? 'animate-spin text-[#D4AF37]' : ''}`}
            >
              <RefreshCcw size={18} />
            </button>
            <button 
              onClick={onLogout}
              className="w-11 h-11 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 transition-all active:scale-90 active:bg-red-500 active:text-white"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
      )}

      <main className={`flex-1 overflow-y-auto scroll-smooth ${!hideShell ? 'pb-32 px-5 pt-6' : ''} animate-lux-fade scrollbar-hide`}>
        <div className="w-full h-full max-w-2xl mx-auto">
          {children}
        </div>
      </main>

      {!hideShell && (
        <div className="fixed bottom-0 left-0 right-0 px-6 pb-6 pt-2 z-50 pointer-events-none">
          <nav className="pointer-events-auto w-full max-w-xl mx-auto bg-zinc-900/95 premium-blur rounded-[2rem] border border-white/10 flex justify-around items-center p-2 mb-safe ios-shadow animate-slide-up">
            {currentTabs.map((tab: any) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-all relative ${
                    isActive ? 'text-[#D4AF37] bg-white/5' : 'text-zinc-600'
                  }`}
                >
                  <div className="relative">
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    {tab.notification && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-zinc-900 animate-pulse"></span>
                    )}
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-[0.15em] ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
};

export default Layout;
