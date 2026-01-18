
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './store/database';
import { supabase } from './store/supabase';
import { User, BarberProfile, UserRole } from './types';
import { Language, translations } from './translations';
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
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
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
  
  const t = translations[lang];
  const prevRoleRef = useRef<UserRole | null>(null);

  const syncAllData = useCallback(async (uId: string, uRole: string) => {
    try {
      await Promise.allSettled([
        db.getUsers(),
        db.getBarbers(),
        db.getReviews(),
        db.getServices(),
        db.getBookings(uId, uRole)
      ]);
      window.dispatchEvent(new Event('app-sync-complete'));
    } catch (e) {
      console.warn("Sync warning:", e);
    }
  }, []);

  const handleAuthUser = useCallback(async (supabaseUser: SupabaseUser | {id: string, email: string, user_metadata?: any}) => {
    setIsInitializing(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();
      
      const metadataRole = (supabaseUser as any).user_metadata?.role;
      
      if (!profile && !metadataRole) {
        localStorage.setItem('trimly_partial_user', JSON.stringify({id: supabaseUser.id, email: supabaseUser.email}));
        setUser(null);
        setIsInitializing(false);
        return;
      }

      localStorage.removeItem('trimly_partial_user');

      let rawRole = (profile?.role || metadataRole || 'customer').toLowerCase().trim();
      let finalRole: UserRole = 'customer';
      
      if (rawRole === 'admin') finalRole = 'admin';
      else if (rawRole === 'barber') finalRole = 'barber';
      
      const fullUser: User = { 
        id: supabaseUser.id, 
        email: supabaseUser.email || profile?.email || '', 
        role: finalRole,
        fullName: profile?.full_name || (supabaseUser as any).user_metadata?.full_name || '',
        avatarUrl: profile?.avatar_url || '',
        banned: !!profile?.banned
      };
      
      if (prevRoleRef.current && prevRoleRef.current !== finalRole) {
        setActiveTab('home');
      }
      prevRoleRef.current = finalRole;

      setUser(fullUser);
      db.setActiveUser(fullUser);
      setDbStatus('connected');
      
      await syncAllData(fullUser.id, finalRole);

      if (finalRole === 'barber') {
        const barbers = await db.getBarbers();
        const bProf = barbers.find(b => b.userId === fullUser.id);
        setBarberProfile(bProf || null);
      }
    } catch (err: any) {
      console.error("Auth Critical Error:", err);
      if (supabaseUser.id) {
         setUser({ id: supabaseUser.id, email: supabaseUser.email || '', role: 'customer' });
      }
    } finally {
      setIsInitializing(false);
    }
  }, [syncAllData]);

  // Global Real-time Listeners for Bookings
  useEffect(() => {
    if (!user) return;

    const column = user.role === 'customer' ? 'customer_id' : 'barber_id';
    
    const channel = supabase
      .channel(`global-bookings-${user.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'bookings', 
        filter: `${column}=eq.${user.id}` 
      }, (payload) => {
        const status = payload.new.status;
        const oldStatus = payload.old.status;

        if (status !== oldStatus) {
           if (user.role === 'customer') {
              if (status === 'accepted') setToast({ message: 'Termin prihvaćen! 🎉', type: 'success' });
              if (status === 'rejected') setToast({ message: 'Nažalost, termin je odbijen.', type: 'error' });
           } else {
              if (status === 'pending') setToast({ message: 'Novi zahtjev za šišanje! ✂️', type: 'success' });
              if (status === 'cancelled') setToast({ message: 'Klijent je otkazao termin.', type: 'error' });
           }
           // Trigger sync to refresh UI
           db.getBookings(user.id, user.role);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: `${column}=eq.${user.id}`
      }, (payload) => {
        if (user.role === 'barber') {
           setToast({ message: 'Novi zahtjev za šišanje! ✂️', type: 'success' });
           db.getBookings(user.id, user.role);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      const updated = db.getActiveUser();
      if (updated) {
        setUser(prev => prev ? { ...prev, ...updated } : updated);
      }
    };

    window.addEventListener('user-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('user-profile-updated', handleProfileUpdate);
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'barber') return;

    const channel = supabase
      .channel(`barber-approval-${user.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'barbers', 
        filter: `user_id=eq.${user.id}` 
      }, async (payload) => {
        if (payload.new && payload.new.approved === true) {
          const barbers = await db.getBarbers();
          const bProf = barbers.find(b => b.userId === user.id);
          setBarberProfile(bProf || null);
          setToast({ message: "Vaš profil je odobren!", type: 'success' });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
        handleAuthUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setBarberProfile(null);
        setIsInitializing(false);
        localStorage.removeItem('trimly_active_user');
        localStorage.removeItem('trimly_partial_user');
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
    setIsInitializing(false);
  };

  if (isInitializing) {
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center p-12">
        <Loader2 className="animate-spin text-[#D4AF37] mb-4" size={48} />
        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic">Pristupanje mreži...</span>
      </div>
    );
  }

  const partialUser = localStorage.getItem('trimly_partial_user');
  if (!user && partialUser) {
    const pU = JSON.parse(partialUser);
    return (
      <RegisterScreen 
        lang={lang} 
        setLang={setLang} 
        onLogin={(u) => handleAuthUser(u)} 
        onToggle={handleLogout} 
        dbStatus={dbStatus}
        forceUserEmail={pU.email}
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
        case 'profile': return <CustomerProfile user={user} lang={lang} onLogout={handleLogout} />;
        default: return <CustomerHome lang={lang} onSelectBarber={setSelectedBarberId} />;
      }
    }

    if (user.role === 'barber') {
      if (!barberProfile) {
        return <BarberProfileForm lang={lang} userId={user.id} onComplete={() => handleAuthUser({id: user.id, email: user.email} as any)} onLogout={handleLogout} />;
      }
      if (!barberProfile.approved) {
        return <BarberWaitingRoom lang={lang} onLogout={handleLogout} onRefresh={() => handleAuthUser({id: user.id, email: user.email} as any)} />;
      }
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
