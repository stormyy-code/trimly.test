
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './store/database.ts';
import { supabase } from './store/supabase.ts';
import { User, BarberProfile, UserRole } from './types.ts';
import { Language, translations } from './translations.ts';
import LoginScreen from './screens/auth/LoginScreen.tsx';
import RegisterScreen from './screens/auth/RegisterScreen.tsx';
import Layout from './components/Layout.tsx';
import CustomerHome from './screens/customer/CustomerHome.tsx';
import BarberProfileDetail from './screens/customer/BarberProfileDetail.tsx';
import CustomerBookings from './screens/customer/CustomerBookings.tsx';
import CustomerProfile from './screens/customer/CustomerProfile.tsx';
import BarberDashboard from './screens/barber/BarberDashboard.tsx';
import BarberServices from './screens/barber/BarberServices.tsx';
import BarberProfileForm from './screens/barber/BarberProfileForm.tsx';
import BarberWaitingRoom from './screens/barber/BarberWaitingRoom.tsx';
import BarberAvailability from './screens/barber/BarberAvailability.tsx';
import AdminDashboard from './screens/admin/AdminDashboard.tsx';
import AdminBarbers from './screens/admin/AdminBarbers.tsx';
import AdminApprovals from './screens/admin/AdminApprovals.tsx';
import LeaderboardScreen from './screens/shared/LeaderboardScreen.tsx';
import { Loader2 } from 'lucide-react';
import { Toast } from './components/UI.tsx';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error';
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('trimly_awaiting_verification') === 'true' ? 'register' : 'home';
  });
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [lang, setLang] = useState<Language>('hr'); 
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  
  const prevRoleRef = useRef<UserRole | null>(null);
  const lastToastRef = useRef<{ msg: string, time: number }>({ msg: '', time: 0 });

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const now = Date.now();
    if (lastToastRef.current.msg === message && now - lastToastRef.current.time < 1000) {
      return;
    }
    lastToastRef.current = { msg: message, time: now };
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleAuthUser = useCallback(async (supabaseUser: any): Promise<User | null> => {
    if (!supabaseUser) {
      setIsInitializing(false);
      setUser(null);
      return null;
    }
    
    // GVOZDENA ZAVJESA: Ako email nije potvrđen, brišemo usera iz statea i bacamo ga na register (OTP ekran)
    // Ovo sprječava ulazak u aplikaciju čak i ako je Supabase izdao session.
    if (!supabaseUser.email_confirmed_at) {
      console.log("Blocking entry: Email not confirmed.");
      localStorage.setItem('trimly_awaiting_verification', 'true');
      setUser(null);
      setIsInitializing(false);
      setActiveTab('register');
      return null;
    }

    // Ako je potvrđen, mičemo lockove
    localStorage.removeItem('trimly_awaiting_verification');

    setIsInitializing(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();
      
      let rawRole = (profile?.role || supabaseUser.user_metadata?.role || 'customer').toLowerCase().trim();
      let finalRole: UserRole = 'customer';
      if (rawRole === 'admin') finalRole = 'admin';
      else if (rawRole === 'barber') finalRole = 'barber';
      
      const fullUser: User = { 
        id: supabaseUser.id, 
        email: supabaseUser.email || profile?.email || '', 
        role: finalRole,
        fullName: profile?.full_name || supabaseUser.user_metadata?.full_name || '',
        avatarUrl: profile?.avatar_url || '',
        banned: !!profile?.banned
      };
      
      setUser(fullUser);
      db.setActiveUser(fullUser);
      setDbStatus('connected');

      if (finalRole === 'barber') {
        const bProf = await db.getBarberByUserId(fullUser.id);
        setBarberProfile(bProf || null);
      }
      
      return fullUser;
    } catch (err: any) {
      console.error("Auth Error:", err);
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          await handleAuthUser(session.user);
        } else if (mounted) {
          setIsInitializing(false);
        }
      } catch (e) {
        if (mounted) setIsInitializing(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        // Ponovno provjeravamo potvrdu kod svakog eventa
        if (!session.user.email_confirmed_at) {
          setUser(null);
          setActiveTab('register');
          localStorage.setItem('trimly_awaiting_verification', 'true');
        } else {
          handleAuthUser(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setBarberProfile(null);
        setIsInitializing(false);
        localStorage.removeItem('trimly_awaiting_verification');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [handleAuthUser]);

  const handleLogout = async () => {
    setIsInitializing(true);
    await supabase.auth.signOut();
    setUser(null);
    setBarberProfile(null);
    setActiveTab('home');
    localStorage.removeItem('trimly_awaiting_verification');
    setIsInitializing(false);
  };

  const renderView = () => {
    const isAwaiting = localStorage.getItem('trimly_awaiting_verification') === 'true';

    // Ako nemamo potvrđenog korisnika u stateu, pokazujemo registraciju/login
    if (!user || isAwaiting) {
      if (activeTab === 'register' || isAwaiting) {
        return <RegisterScreen lang={lang} setLang={setLang} onLogin={handleAuthUser} onToggle={() => setActiveTab('login')} dbStatus={dbStatus} />;
      }
      return <LoginScreen lang={lang} setLang={setLang} onLogin={handleAuthUser} onToggle={() => setActiveTab('register')} dbStatus={dbStatus} />;
    }

    if (selectedBarberId) return <BarberProfileDetail lang={lang} barberId={selectedBarberId} onBack={() => setSelectedBarberId(null)} user={user} />;

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
      if (!barberProfile) return <BarberProfileForm lang={lang} userId={user.id} onComplete={() => handleAuthUser({id: user.id, email: user.email})} onLogout={handleLogout} />;
      if (!barberProfile.approved) return <BarberWaitingRoom lang={lang} onLogout={handleLogout} onRefresh={async () => { await handleAuthUser({id: user.id, email: user.email}); }} />;
      
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

  if (isInitializing) {
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center p-12">
        <Loader2 className="animate-spin text-[#D4AF37] mb-4" size={48} />
        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic text-center">Trimly Zagreb</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black">
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
          {renderView()}
        </Layout>
      ) : (
        renderView()
      )}
      
      <div className="fixed top-12 left-4 right-4 z-[999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </div>
  );
};

export default App;
