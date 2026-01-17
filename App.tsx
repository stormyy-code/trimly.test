
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './store/database';
import { supabase } from './store/supabase';
import { User, BarberProfile, UserRole } from './types';
import { Language, translations } from './translations';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import ChangePasswordScreen from './screens/auth/ChangePasswordScreen';
import Layout from './components/Layout';
import CustomerHome from './screens/customer/CustomerHome';
import BarberProfileDetail from './screens/customer/BarberProfileDetail';
import CustomerBookings from './screens/customer/CustomerBookings';
import CustomerProfile from './screens/customer/CustomerProfile';
import BarberDashboard from './screens/barber/BarberDashboard';
import BarberServices from './screens/barber/BarberServices';
import BarberProfileForm from './screens/barber/BarberProfileForm';
import BarberAvailability from './screens/barber/BarberAvailability';
import AdminDashboard from './screens/admin/AdminDashboard';
import AdminBarbers from './screens/admin/AdminBarbers';
import AdminApprovals from './screens/admin/AdminApprovals';
import LeaderboardScreen from './screens/shared/LeaderboardScreen';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { 
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { Toast } from './components/UI';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [lang, setLang] = useState<Language>('hr'); 
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  
  const t = translations[lang];
  const prevRoleRef = useRef<UserRole | null>(null);

  const syncAllData = useCallback(async (uId: string, uRole: string) => {
    try {
      await db.getUsers(); 
      await db.getBarbers();
      await db.getReviews();
      await db.getServices();
      await db.getBookings(uId, uRole);
      
      window.dispatchEvent(new Event('app-sync-complete'));
    } catch (e) {
      console.warn("Sync error:", e);
    }
  }, []);

  const handleAuthUser = useCallback(async (supabaseUser: SupabaseUser) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();
      
      if (error) console.warn("Profile fetch error:", error.message);

      let finalRole: UserRole = 'customer';
      if (profile && profile.role) {
        const rawRole = profile.role.toLowerCase().trim();
        if (rawRole === 'admin') finalRole = 'admin';
        else if (rawRole === 'barber') finalRole = 'barber';
      }
      
      const fullUser = { 
        id: supabaseUser.id, 
        email: supabaseUser.email || '', 
        role: finalRole,
        fullName: profile?.fullName || profile?.full_name || '',
        avatarUrl: profile?.avatarUrl || profile?.avatar_url || '',
        banned: profile?.banned || false
      } as User;
      
      if (prevRoleRef.current && prevRoleRef.current !== finalRole) {
        setActiveTab('home');
      }
      prevRoleRef.current = finalRole;

      setUser(fullUser);
      db.setActiveUser(fullUser);
      setDbStatus('connected');
      
      syncAllData(fullUser.id, finalRole);

      if (finalRole === 'barber') {
        db.getBarbers().then(barbers => {
          const bProf = (barbers || []).find(b => b.userId === fullUser.id);
          setBarberProfile(bProf || null);
        });
      }
    } catch (err: any) {
      console.error("Auth handler error:", err);
      setUser({ id: supabaseUser.id, email: supabaseUser.email || '', role: 'customer' as UserRole });
    } finally {
      setIsInitializing(false);
    }
  }, [syncAllData]);

  useEffect(() => {
    const handleProfileRefresh = () => {
      const active = db.getActiveUser();
      if (active) {
        setUser(prev => prev ? { ...prev, ...active } : active);
      }
    };

    window.addEventListener('user-profile-updated', handleProfileRefresh);
    return () => window.removeEventListener('user-profile-updated', handleProfileRefresh);
  }, []);

  useEffect(() => {
    let mounted = true;

    // Prva provjera: Ako URL sadrži recovery token
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsRecoveringPassword(true);
    }

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          // Ako smo u recovery modu, nemoj automatski povlačiti profil kao logged-in, 
          // jer recovery session ima ograničena prava dok se lozinka ne promijeni.
          if (!isRecoveringPassword) {
            await handleAuthUser(session.user);
          } else {
            setIsInitializing(false);
          }
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

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveringPassword(true);
        setIsInitializing(false);
      } else if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        // Ako smo usred recovery-ja, USER_UPDATED će se desiti nakon promjene lozinke
        if (!isRecoveringPassword) {
          handleAuthUser(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setBarberProfile(null);
        setIsRecoveringPassword(false);
        setIsInitializing(false);
        localStorage.clear();
      }
    });

    const profileChannel = supabase
      .channel('public-profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.new) {
          const { id, banned } = payload.new;
          window.dispatchEvent(new CustomEvent('users-registry-updated', { detail: { userId: id, banned } }));
          if (id === user?.id && banned === true) {
            setToast({ message: translations[lang].suspendedError, type: 'error' });
            setTimeout(handleLogout, 2000);
          }
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      supabase.removeChannel(profileChannel);
    };
  }, [handleAuthUser, user?.id, lang, isRecoveringPassword]);

  const handleLogout = async () => {
    setIsInitializing(true);
    await supabase.auth.signOut();
    setUser(null);
    setBarberProfile(null);
    setIsRecoveringPassword(false);
    setActiveTab('home');
    setIsInitializing(false);
    // Očisti hash iz URL-a
    window.location.hash = '';
  };

  if (isInitializing) {
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center p-12">
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-[#D4AF37]/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
          <Loader2 className="animate-spin text-[#D4AF37] relative z-10" size={48} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500 animate-pulse text-center leading-loose">
          Trimly Zagreb<br/>Secure Syncing
        </p>
      </div>
    );
  }

  // Ako detektiramo recovery mod iz URL-a ili eventa
  if (isRecoveringPassword) {
    return (
      <ChangePasswordScreen 
        lang={lang} 
        onComplete={() => {
          setIsRecoveringPassword(false);
          setToast({ message: t.passwordUpdated, type: 'success' });
          handleLogout(); // Odjava nakon uspješne promjene
        }} 
      />
    );
  }

  const renderView = () => {
    if (!user) {
      return activeTab === 'register' 
        ? <RegisterScreen lang={lang} setLang={setLang} onLogin={handleAuthUser as any} onToggle={() => setActiveTab('login')} dbStatus={dbStatus} />
        : <LoginScreen lang={lang} setLang={setLang} onLogin={handleAuthUser as any} onToggle={() => setActiveTab('register')} dbStatus={dbStatus} />;
    }

    if (selectedBarberId) return <BarberProfileDetail lang={lang} barberId={selectedBarberId} onBack={() => setSelectedBarberId(null)} user={user} />;

    if (user.role === 'customer') {
      switch (activeTab) {
        case 'home': return <CustomerHome lang={lang} onSelectBarber={setSelectedBarberId} />;
        case 'leaderboard': return <LeaderboardScreen lang={lang} onSelectBarber={setSelectedBarberId} />;
        case 'bookings': return <CustomerBookings lang={lang} user={user} />;
        case 'profile': return <CustomerProfile user={user} lang={lang} onLogout={handleLogout} onRoleUpdate={() => {}} />;
        default: return <CustomerHome lang={lang} onSelectBarber={setSelectedBarberId} />;
      }
    }

    if (user.role === 'barber') {
      if (!barberProfile) return <BarberProfileForm lang={lang} userId={user.id} onComplete={() => handleAuthUser({id: user.id, email: user.email} as any)} />;
      switch (activeTab) {
        case 'home': return <BarberDashboard lang={lang} barberId={barberProfile.id} />;
        case 'leaderboard': return <LeaderboardScreen lang={lang} onSelectBarber={setSelectedBarberId} />;
        case 'schedule': return <BarberAvailability lang={lang} barberId={barberProfile.id} />;
        case 'services': return <BarberServices lang={lang} barberId={barberProfile.id} />;
        case 'profile': return <BarberProfileForm lang={lang} userId={user.id} onComplete={() => {}} />;
        default: return <BarberDashboard lang={lang} barberId={barberProfile.id} />;
      }
    }

    if (user.role === 'admin') {
      switch (activeTab) {
        case 'home': return <AdminDashboard lang={lang} onLogout={handleLogout} />;
        case 'leaderboard': return <LeaderboardScreen lang={lang} onSelectBarber={setSelectedBarberId} />;
        case 'barbers': return <AdminBarbers lang={lang} onSelectBarber={setSelectedBarberId} />;
        case 'approvals': return <AdminApprovals lang={lang} />;
        case 'settings': return (
          <div className="flex flex-col items-center justify-center pt-20 space-y-8">
             <ShieldCheck size={80} className="text-[#D4AF37]" />
             <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Network Command</h2>
             <button onClick={handleLogout} className="bg-red-500/10 text-red-500 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]">Odjavi se</button>
          </div>
        );
        default: return <AdminDashboard lang={lang} onLogout={handleLogout} />;
      }
    }
    return null;
  };

  return (
    <div className="h-full w-full bg-black">
      {user ? (
        <Layout 
          role={user.role} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          onLogout={handleLogout}
          lang={lang}
          hideShell={!!selectedBarberId} 
          title={user.role === 'admin' ? 'Network Command' : user.role === 'barber' ? 'Barber Hub' : 'Trimly Zagreb'}
        >
          {renderView()}
        </Layout>
      ) : (
        renderView()
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
