
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
import { Loader2 } from 'lucide-react';
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
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [lang, setLang] = useState<Language>('hr'); 
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  
  const prevRoleRef = useRef<UserRole | null>(null);
  const lastToastRef = useRef<{ msg: string, time: number }>({ msg: '', time: 0 });
  const knownApprovalRef = useRef<boolean>(false);

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

  // Updated handleAuthUser to return Promise<User | null> and include return statements to match component onLogin prop expectations.
  const handleAuthUser = useCallback(async (supabaseUser: any): Promise<User | null> => {
    setIsInitializing(true);
    try {
      if (!supabaseUser) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();
      
      const metadataRole = supabaseUser.user_metadata?.role;
      
      if (!profile && !metadataRole) {
        localStorage.setItem('trimly_partial_user', JSON.stringify({id: supabaseUser.id, email: supabaseUser.email}));
        setUser(null);
        setIsInitializing(false);
        return null;
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
        fullName: profile?.full_name || supabaseUser.user_metadata?.full_name || '',
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
        knownApprovalRef.current = bProf?.approved || false;
      }
      return fullUser;
    } catch (err: any) {
      console.error("Auth Critical Error:", err);
      if (supabaseUser && supabaseUser.id) {
         const fallbackUser: User = { id: supabaseUser.id, email: supabaseUser.email || '', role: 'customer' };
         setUser(fallbackUser);
         return fallbackUser;
      }
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, [syncAllData]);

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
              if (status === 'accepted') addToast('Termin prihvaćen! 🎉', 'success');
              if (status === 'rejected') addToast('Nažalost, termin je odbijen.', 'error');
           } else {
              if (status === 'pending') addToast('Novi zahtjev za šišanje! ✂️', 'success');
              if (status === 'cancelled') addToast('Klijent je otkazao termin.', 'error');
           }
           db.getBookings(user.id, user.role);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: `${column}=eq.${user.id}`
      }, () => {
        if (user.role === 'barber') {
           addToast('Novi zahtjev za šišanje! ✂️', 'success');
           db.getBookings(user.id, user.role);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addToast]);

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
      .channel(`barber-approval-monitor-${user.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'barbers', 
        filter: `user_id=eq.${user.id}` 
      }, async (payload) => {
        const isNowApproved = payload.new?.approved === true;

        // Ključna logika: Toast šaljemo samo ako 'knownApprovalRef' kaže da profil NISMO znali kao odobren
        if (isNowApproved && !knownApprovalRef.current) {
          knownApprovalRef.current = true; // Odmah označi kao poznato odobreno
          addToast("Vaš profil je odobren! 🎉", "success");
        }
        
        // Sinkronizacija profila bez obzira na toast
        const barbers = await db.getBarbers();
        const bProf = barbers.find(b => b.userId === user.id);
        setBarberProfile(bProf || null);
        if (bProf) knownApprovalRef.current = bProf.approved;
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addToast]);

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
        knownApprovalRef.current = false;
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
    knownApprovalRef.current = false;
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
        ? <RegisterScreen lang={lang} setLang={setLang} onLogin={handleAuthUser} onToggle={() => setActiveTab('login')} dbStatus={dbStatus} />
        : <LoginScreen lang={lang} setLang={setLang} onLogin={handleAuthUser} onToggle={() => setActiveTab('register')} dbStatus={dbStatus} />;
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
        // Fix: Added block statement to onComplete callback to ensure it returns void.
        return <BarberProfileForm lang={lang} userId={user.id} onComplete={() => { handleAuthUser({id: user.id, email: user.email}); }} onLogout={handleLogout} />;
      }
      if (!barberProfile.approved) {
        // Fix: Added async wrapper to onRefresh to ensure it returns Promise<void>, fixing the type mismatch.
        return <BarberWaitingRoom lang={lang} onLogout={handleLogout} onRefresh={async () => { await handleAuthUser({id: user.id, email: user.email}); }} />;
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
      
      <div className="fixed top-12 left-4 right-4 z-[999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </div>
  );
};

export default App;
