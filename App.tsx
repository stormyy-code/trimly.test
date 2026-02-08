
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from './store/database';
import { supabase } from './store/supabase';
import { User, BarberProfile, UserRole } from './types';
import { Language } from './translations';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import Layout from './components/Layout';
import CustomerHome from './screens/customer/CustomerHome';
import BarberProfileDetail from './screens/customer/BarberProfileDetail';
import CustomerBookings from './screens/customer/CustomerBookings';
import CustomerProfile from './screens/customer/CustomerProfile';
import BarberDashboard from './screens/barber/BarberDashboard';
import BarberServices from './screens/barber/BarberServices';
import BarberProfileForm from './screens/barber/BarberProfileForm';
import BarberWaitingRoom from './screens/barber/BarberWaitingRoom';
import BarberAvailability from './screens/barber/BarberAvailability';
import AdminDashboard from './screens/admin/AdminDashboard';
import AdminBarbers from './screens/admin/AdminBarbers';
import AdminApprovals from './screens/admin/AdminApprovals';
import LeaderboardScreen from './screens/shared/LeaderboardScreen';
import { Loader2, BellRing, Sparkles } from 'lucide-react';
import { Toast } from './components/UI';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error';
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [lang, setLang] = useState<Language>('hr'); 
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [isAwaitingVerify, setIsAwaitingVerify] = useState(() => localStorage.getItem('trimly_awaiting_verification') === 'true');

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const requestPushPermission = async () => {
    if (!('Notification' in window)) return;
    
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      showToast(lang === 'hr' ? 'Obavijesti aktivirane!' : 'Notifications enabled!', 'success');
      setShowPushPrompt(false);
      localStorage.setItem('trimly_push_enabled', 'true');
    } else {
      showToast(lang === 'hr' ? 'Obavijesti su blokirane.' : 'Notifications blocked.', 'error');
      setShowPushPrompt(false);
    }
  };

  const handleAuthUser = useCallback(async (supabaseUser: any) => {
    if (!supabaseUser) {
      setUser(null);
      setIsInitializing(false);
      return;
    }

    if (!supabaseUser.email_confirmed_at) {
      localStorage.setItem('trimly_awaiting_verification', 'true');
      setIsAwaitingVerify(true);
      setUser(null);
      setIsInitializing(false);
      return;
    }

    localStorage.removeItem('trimly_awaiting_verification');
    setIsAwaitingVerify(false);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();
      
      const role = (profile?.role || supabaseUser.user_metadata?.role || 'customer') as UserRole;
      
      const fullUser: User = { 
        id: supabaseUser.id, 
        email: supabaseUser.email, 
        role: role,
        fullName: profile?.full_name || '',
        avatarUrl: profile?.avatar_url || '',
        banned: !!profile?.banned
      };
      
      setUser(fullUser);
      db.setActiveUser(fullUser);

      if (role === 'barber') {
        const bProf = await db.getBarberByUserId(fullUser.id);
        setBarberProfile(bProf || null);
      }

      if (Notification.permission === 'default' && !localStorage.getItem('trimly_push_enabled')) {
        setTimeout(() => setShowPushPrompt(true), 3000);
      }

    } catch (err) {
      console.error("Auth fetch error:", err);
    } finally {
      setIsInitializing(false);
    }
  }, [lang, showToast]);

  useEffect(() => {
    const handleGlobalToast = (e: any) => {
      if (e.detail) showToast(e.detail.message, e.detail.type);
    };
    window.addEventListener('app-show-toast', handleGlobalToast as any);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleAuthUser(session.user);
      else setIsInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) handleAuthUser(session.user);
      else {
        setUser(null);
        setBarberProfile(null);
        setIsAwaitingVerify(false);
        setIsInitializing(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('app-show-toast', handleGlobalToast as any);
    };
  }, [handleAuthUser, showToast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.reload();
  };

  if (isInitializing) {
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center p-12">
        <Loader2 className="animate-spin text-[#D4AF37] mb-4" size={48} />
        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic text-center">Trimly Zagreb Network...</span>
      </div>
    );
  }

  const mainContent = () => {
    if (isAwaitingVerify) {
      return (
        <RegisterScreen 
          lang={lang} 
          setLang={setLang} 
          onLogin={handleAuthUser} 
          onToggle={() => {
            localStorage.removeItem('trimly_awaiting_verification');
            setIsAwaitingVerify(false);
          }} 
          dbStatus="connected" 
        />
      );
    }

    if (!user) {
      return activeTab === 'register' ? (
        <RegisterScreen lang={lang} setLang={setLang} onLogin={handleAuthUser} onToggle={() => setActiveTab('login')} dbStatus="connected" />
      ) : (
        <LoginScreen lang={lang} setLang={setLang} onLogin={handleAuthUser} onToggle={() => setActiveTab('register')} dbStatus="connected" />
      );
    }

    if (selectedBarberId) {
      return <BarberProfileDetail lang={lang} barberId={selectedBarberId} onBack={() => setSelectedBarberId(null)} user={user} />;
    }

    if (user.role === 'customer') {
      switch (activeTab) {
        case 'home': return <CustomerHome lang={lang} onSelectBarber={setSelectedBarberId} />;
        case 'leaderboard': return <LeaderboardScreen lang={lang} onSelectBarber={setSelectedBarberId} />;
        case 'bookings': return <CustomerBookings lang={lang} user={user} />;
        case 'profile': return <CustomerProfile user={user} lang={lang} onLogout={handleLogout} />;
        default: return <CustomerHome lang={lang} onSelectBarber={setSelectedBarberId} />;
      }
    }

    if (user.role === 'barber') {
      if (!barberProfile) return <BarberProfileForm lang={lang} userId={user.id} onComplete={() => window.location.reload()} onLogout={handleLogout} />;
      if (!barberProfile.approved) return <BarberWaitingRoom lang={lang} onLogout={handleLogout} onRefresh={async () => window.location.reload()} />;
      
      switch (activeTab) {
        case 'home': return <BarberDashboard lang={lang} barberId={barberProfile.id} />;
        case 'leaderboard': return <LeaderboardScreen lang={lang} onSelectBarber={setSelectedBarberId} />;
        case 'schedule': return <BarberAvailability lang={lang} barberId={barberProfile.id} />;
        case 'services': return <BarberServices lang={lang} barberId={barberProfile.id} />;
        case 'profile': return <BarberProfileForm lang={lang} userId={user.id} onComplete={() => {}} onLogout={handleLogout} />;
        default: return <BarberDashboard lang={lang} barberId={barberProfile.id} />;
      }
    }

    if (user.role === 'admin') {
      switch (activeTab) {
        case 'home': return <AdminDashboard lang={lang} onLogout={handleLogout} />;
        case 'leaderboard': return <LeaderboardScreen lang={lang} onSelectBarber={setSelectedBarberId} />;
        case 'barbers': return <AdminBarbers lang={lang} onSelectBarber={setSelectedBarberId} />;
        case 'approvals': return <AdminApprovals lang={lang} />;
        default: return <AdminDashboard lang={lang} onLogout={handleLogout} />;
      }
    }

    return null;
  };

  return (
    <div className="h-full w-full bg-black overflow-hidden relative">
      {/* GLOBAL TOAST PORTAL - ABSOLUTE FIXED TO SCREEN */}
      <div className="fixed top-0 left-0 right-0 z-[10000] pointer-events-none flex flex-col items-center pt-safe px-6 gap-3 pt-6">
        {showPushPrompt && (
          <div className="w-full max-w-sm pointer-events-auto animate-lux-fade origin-top">
             <div className="p-4 bg-zinc-900 border border-[#D4AF37]/40 rounded-[2rem] shadow-2xl flex items-center justify-between gap-4 premium-blur">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-[#D4AF37] rounded-xl flex items-center justify-center text-black">
                      <BellRing size={20} />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-white uppercase italic tracking-tighter">Ostani u tijeku</span>
                      <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Aktiviraj sistemske obavijesti</span>
                   </div>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => setShowPushPrompt(false)} className="px-4 py-2 text-[8px] font-black text-zinc-600 uppercase tracking-widest">Kasnije</button>
                   <button onClick={requestPushPermission} className="px-5 py-2 bg-[#D4AF37] text-black rounded-xl text-[8px] font-black uppercase tracking-widest shadow-xl">Aktiviraj</button>
                </div>
             </div>
          </div>
        )}
        
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      {user ? (
        <Layout 
          role={user.role} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          onLogout={handleLogout}
          lang={lang}
          hideShell={!!selectedBarberId || (user.role === 'barber' && barberProfile && !barberProfile.approved)} 
          title={user.role === 'admin' ? 'Network Command' : user.role === 'barber' ? 'Barber Hub' : 'Trimly Zagreb'}
        >
          {mainContent()}
        </Layout>
      ) : mainContent()}
    </div>
  );
};

export default App;
