
import React, { useState, useEffect, useCallback } from 'react';
import { db } from './store/mockDatabase';
import { supabase } from './store/supabase';
import { User, BarberProfile, Booking } from './types';
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
import BarberAvailability from './screens/barber/BarberAvailability';
import AdminDashboard from './screens/admin/AdminDashboard';
import AdminBarbers from './screens/admin/AdminBarbers';
import AdminApprovals from './screens/admin/AdminApprovals';
import LeaderboardScreen from './screens/shared/LeaderboardScreen';
import { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { 
  Loader2,
  ShieldCheck,
  LogOut
} from 'lucide-react';
import { Toast, Button } from './components/UI';

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

  const syncAllData = useCallback(async (uId: string, uRole: string) => {
    try {
      await Promise.all([
        db.getBarbers(),
        db.getServices(),
        db.getBookings(uId, uRole),
        db.getReviews()
      ]);
      window.dispatchEvent(new Event('app-sync-complete'));
    } catch (e) {
      console.error("Initial data sync failed:", e);
    }
  }, []);

  const handleAuthUser = useCallback(async (supabaseUser: SupabaseUser) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();
      
    const fullUser = { 
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      role: (profile?.role as any) || 'customer' 
    } as User;
    
    setUser(fullUser);
    db.setActiveUser(fullUser);
    syncAllData(fullUser.id, fullUser.role);

    if (fullUser.role === 'barber') {
      const barbers = await db.getBarbers();
      const bProf = barbers.find(b => b.userId === fullUser.id);
      setBarberProfile(bProf || null);
    }
  }, [syncAllData]);

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await handleAuthUser(session.user);
      }
      setIsInitializing(false);
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        await handleAuthUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setBarberProfile(null);
        db.setActiveUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleAuthUser]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload: any) => {
          const newB = payload.new as Booking;
          if (user.role === 'customer' && newB.customerId === user.id && newB.status === 'accepted') {
            setToast({ 
              message: lang === 'hr' ? `Brijač je potvrdio tvoj termin u ${newB.time}h!` : `Barber confirmed your slot at ${newB.time}h!`, 
              type: 'success' 
            });
          }
          if (user.role === 'barber' && barberProfile && newB.barberId === barberProfile.id && payload.eventType === 'INSERT') {
            setToast({ 
              message: lang === 'hr' ? 'Imaš novi zahtjev za šišanje!' : 'You have a new booking request!', 
              type: 'success' 
            });
          }
          db.getBookings(user.id, user.role);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, barberProfile, lang]);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) throw error;
        setDbStatus('connected');
      } catch (e) {
        setDbStatus('error');
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setBarberProfile(null);
      setSelectedBarberId(null);
      setActiveTab('home');
      db.setActiveUser(null);
      localStorage.removeItem('bb_barbers_cache');
      localStorage.removeItem('bb_services_cache');
      localStorage.removeItem('bb_bookings_cache');
    } catch (e) {
      console.error("Logout error:", e);
      setUser(null);
    }
  };

  if (isInitializing) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-[#D4AF37]" size={48} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 animate-pulse italic tracking-tighter">TRIMLY INITIALIZING...</p>
      </div>
    );
  }

  const renderView = () => {
    if (!user) {
      return activeTab === 'register' 
        ? <RegisterScreen lang={lang} setLang={setLang} onLogin={() => {}} onToggle={() => setActiveTab('login')} dbStatus={dbStatus} />
        : <LoginScreen lang={lang} setLang={setLang} onLogin={() => {}} onToggle={() => setActiveTab('register')} dbStatus={dbStatus} />;
    }

    if (user.role === 'customer') {
      if (selectedBarberId) return <BarberProfileDetail lang={lang} barberId={selectedBarberId} onBack={() => setSelectedBarberId(null)} user={user} />;
      switch (activeTab) {
        case 'home': return <CustomerHome lang={lang} onSelectBarber={setSelectedBarberId} />;
        case 'leaderboard': return <LeaderboardScreen lang={lang} />;
        case 'bookings': return <CustomerBookings lang={lang} customerId={user.id} />;
        case 'profile': return <CustomerProfile user={user} lang={lang} onLogout={handleLogout} />;
        default: return <CustomerHome lang={lang} onSelectBarber={setSelectedBarberId} />;
      }
    }

    if (user.role === 'barber') {
      if (!barberProfile) return <BarberProfileForm lang={lang} userId={user.id} onComplete={() => handleAuthUser(user as any)} />;
      if (!barberProfile.approved) return (
        <div className="flex flex-col items-center justify-center text-center p-10 min-h-[70vh] space-y-12 animate-lux-fade">
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{lang === 'hr' ? 'Račun na čekanju' : 'Pending Approval'}</h2>
          <Button variant="secondary" onClick={handleLogout}>{t.logout}</Button>
        </div>
      );
      switch (activeTab) {
        case 'home': return <BarberDashboard lang={lang} barberId={barberProfile.id} />;
        case 'leaderboard': return <LeaderboardScreen lang={lang} />;
        case 'schedule': return <BarberAvailability lang={lang} barberId={barberProfile.id} />;
        case 'services': return <BarberServices lang={lang} barberId={barberProfile.id} />;
        case 'profile': return <BarberProfileForm lang={lang} userId={user.id} onComplete={() => handleAuthUser(user as any)} />;
        default: return <BarberDashboard lang={lang} barberId={barberProfile.id} />;
      }
    }

    if (user.role === 'admin') {
      switch (activeTab) {
        case 'home': return <AdminDashboard lang={lang} onLogout={handleLogout} />;
        case 'leaderboard': return <LeaderboardScreen lang={lang} />;
        case 'barbers': return <AdminBarbers lang={lang} />;
        case 'approvals': return <AdminApprovals lang={lang} />;
        case 'settings': return (
          <div className="space-y-8 animate-lux-fade">
            <div className="flex flex-col items-center pt-8 pb-4">
              <div className="w-24 h-24 bg-zinc-900 rounded-[2.5rem] border border-white/10 flex items-center justify-center text-zinc-600 shadow-2xl mb-6">
                <ShieldCheck size={40} className="text-[#D4AF37]" />
              </div>
              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Admin Panel</h2>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-2">{user.email}</p>
            </div>
            <div className="pt-6">
              <Button variant="danger" className="w-full h-18 text-[11px] font-black tracking-widest" onClick={handleLogout}>
                <LogOut size={18} className="mr-2" /> {t.logout}
              </Button>
            </div>
          </div>
        );
        default: return <AdminDashboard lang={lang} onLogout={handleLogout} />;
      }
    }
    return null;
  };

  const isBarberPending = user?.role === 'barber' && barberProfile && !barberProfile.approved;

  return (
    <div className="h-screen bg-black antialiased overflow-hidden">
      {!user ? (
        <div className="max-w-md mx-auto h-screen bg-black overflow-y-auto">
          {renderView()}
        </div>
      ) : (
        <Layout 
          role={user.role} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          onLogout={handleLogout}
          lang={lang}
          hideShell={!!selectedBarberId || !!isBarberPending} 
          title={user.role === 'admin' ? 'Network Admin' : user.role === 'barber' ? 'Barber Dashboard' : 'Trimly Network'}
        >
          {renderView()}
        </Layout>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
