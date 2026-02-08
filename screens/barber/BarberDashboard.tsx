
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../store/database';
import { supabase } from '../../store/supabase';
import { Booking, User } from '../../types';
import { Card, Badge, Button, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Check, X, Wallet, Scissors, User as UserIcon, TrendingUp, CalendarDays, ShieldAlert, Bell, Loader2, Zap, AlertCircle, Users, Clock, Calendar } from 'lucide-react';
import { APP_CONFIG } from '../../constants';

interface BarberDashboardProps {
  barberId: string;
  lang: Language;
}

const VelocityScale = ({ label, value, max }: { label: string, value: number, max: number }) => (
  <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
    <div className="w-full min-w-0">
      <span className="text-[6px] xs:text-[6.5px] font-black text-[#C5A059] uppercase tracking-wider block truncate">{label}</span>
      <span className="text-[10px] font-black text-white block truncate leading-none mt-0.5">{value}</span>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5 px-0.5">
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`h-full flex-1 rounded-sm transition-all duration-1000 ${i < (value / (max/6 || 1)) ? 'bg-[#C5A059]' : 'bg-zinc-900'}`} />
      ))}
    </div>
  </div>
);

const BarberDashboard: React.FC<BarberDashboardProps> = ({ barberId, lang }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history'>('pending');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>(db.getUsersSync());

  const t = translations[lang];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const refreshAll = async () => {
    const users = await db.getUsers();
    setAllUsers(users);
    await db.getBookings(barberId, 'barber');
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    refreshAll();
    const handleUsersUpdate = (e: any) => {
      setAllUsers(e.detail?.users || db.getUsersSync());
      setRefreshTrigger(prev => prev + 1);
    };
    window.addEventListener('users-registry-updated', handleUsersUpdate);
    window.addEventListener('app-sync-complete', () => refreshAll());
    const channel = supabase.channel('barber-dashboard-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `barber_id=eq.${barberId}` }, () => {
      refreshAll();
    }).subscribe();
    return () => {
      window.removeEventListener('users-registry-updated', handleUsersUpdate);
      supabase.removeChannel(channel);
    };
  }, [barberId]);

  const { pendingBookings, activeBookings, completedBookings, stats, barberShare, competitionCounts } = useMemo(() => {
    const rawBookings = db.getBookingsSync().filter(b => b.barberId === barberId);

    const chronoSort = (a: Booking, b: Booking) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    };

    const pending = rawBookings.filter(b => b.status === 'pending').sort(chronoSort);
    const active = rawBookings.filter(b => b.status === 'accepted').sort(chronoSort);
    const history = rawBookings.filter(b => ['completed', 'rejected', 'cancelled'].includes(b.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const compMap: Record<string, number> = {};
    pending.forEach(b => {
      const key = `${b.date}_${b.time}`;
      compMap[key] = (compMap[key] || 0) + 1;
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const completed = rawBookings.filter(b => b.status === 'completed');
    
    const velocity = {
      daily: completed.filter(b => b.date === todayStr).length,
      monthly: completed.length,
      yearly: completed.length,
    };

    const gross = completed.reduce((sum, b) => sum + b.price, 0);
    const share = gross * APP_CONFIG.BARBER_SHARE;

    return { pendingBookings: pending, activeBookings: active, completedBookings: history, stats: velocity, barberShare: share, competitionCounts: compMap };
  }, [barberId, refreshTrigger]);

  const updateStatus = async (booking: Booking, status: Booking['status']) => {
    setIsUpdating(booking.id);
    if (status === 'accepted') {
      const collisions = pendingBookings.filter(b => b.id !== booking.id && b.date === booking.date && b.time === booking.time);
      for (const coll of collisions) {
        await db.updateBookingStatus(coll.id, 'rejected');
      }
      setToast({ msg: lang === 'hr' ? 'Termin potvrđen! Ostali kandidati odbijeni.' : 'Confirmed! Others declined.', type: 'success' });
    }
    const result = await db.updateBookingStatus(booking.id, status);
    if (result.success) {
      if (status !== 'accepted') setToast({ msg: 'Ažurirano!', type: 'success' });
      await refreshAll();
    } else {
      setToast({ msg: 'Greška!', type: 'error' });
    }
    setIsUpdating(null);
  };

  const renderBookingCard = (booking: Booking) => {
    const isCancelled = booking.status === 'cancelled';
    const client = allUsers.find(u => u.id === booking.customerId);
    const displayName = client?.fullName || booking.customerName || 'Klijent';
    const competitionKey = `${booking.date}_${booking.time}`;
    const compCount = competitionCounts[competitionKey] || 0;
    const hasCompetition = compCount > 1;
    
    return (
      <div key={booking.id} className="relative mt-3">
        {hasCompetition && booking.status === 'pending' && (
          <div className="absolute -top-4 -right-1 z-30 bg-amber-500 text-black text-[7px] font-black px-2 py-0.5 rounded-full shadow-lg border border-black flex items-center gap-1 animate-lux-fade">
            <Users size={8} /> {compCount} ZAHTJEVA ZA OVAJ TERMIN
          </div>
        )}

        <Card className={`p-4 xs:p-5 border-white/5 bg-zinc-950 rounded-[2rem] space-y-4 relative overflow-hidden text-left flex flex-col items-start ${isCancelled ? 'opacity-60 grayscale border-red-500/20 bg-red-500/5' : ''} ${hasCompetition && booking.status === 'pending' ? 'border-amber-500/30' : ''}`}>
          {isUpdating === booking.id && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center">
              <Loader2 className="animate-spin text-[#D4AF37]" size={24} />
            </div>
          )}
          <div className="flex justify-between items-center gap-4 w-full">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="shrink-0 w-11 h-11 bg-zinc-900 rounded-xl flex items-center justify-center border border-white/5 overflow-hidden">
                {client?.avatarUrl ? <img src={client.avatarUrl} className="w-full h-full object-cover" /> : <UserIcon size={18} className="text-zinc-700" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-xs xs:text-sm text-white uppercase italic tracking-tighter leading-none truncate w-full">{displayName}</h3>
                <p className="text-[7px] xs:text-[8px] text-zinc-600 font-black uppercase tracking-widest mt-1.5 truncate">{booking.serviceName}</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1 shrink-0">
              <span className="block font-black text-lg text-white italic tracking-tighter leading-none">{booking.price}€</span>
              <Badge variant={isCancelled ? 'error' : booking.status === 'pending' ? 'warning' : 'success'} className="text-[6px] px-2 py-0.5">
                {isCancelled ? 'OTKAZANO' : booking.status.toUpperCase()}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 p-3 bg-black/40 rounded-2xl border border-white/[0.03] w-full">
            <div className="flex flex-col items-start min-w-0 pl-1">
              <div className="flex items-center gap-1.5 opacity-40">
                <Calendar size={8} />
                <p className="text-[6px] text-zinc-700 font-black uppercase tracking-widest">Datum</p>
              </div>
              <span className="text-[8px] xs:text-[9px] font-black text-zinc-400 truncate block mt-0.5">{formatDate(booking.date)}</span>
            </div>
            <div className="flex flex-col items-start border-l border-white/5 min-w-0 pl-3">
              <div className="flex items-center gap-1.5 opacity-40">
                <Clock size={8} />
                <p className="text-[6px] text-zinc-700 font-black uppercase tracking-widest">Vrijeme</p>
              </div>
              <span className="text-[8px] xs:text-[9px] font-black text-zinc-400 truncate block mt-0.5">{booking.time}h</span>
            </div>
          </div>

          {!isCancelled && booking.status !== 'completed' && booking.status !== 'rejected' && (
            <div className="flex gap-2 w-full pt-1">
              {booking.status === 'pending' && (
                <>
                  <button disabled={!!isUpdating} className="flex-1 h-11 bg-zinc-900 text-zinc-500 rounded-xl text-[7px] font-black uppercase tracking-widest active:scale-95 transition-all" onClick={() => updateStatus(booking, 'rejected')}>{t.decline}</button>
                  <Button variant="primary" disabled={!!isUpdating} className="flex-[2] h-11 text-[7px] uppercase font-black rounded-xl" onClick={() => updateStatus(booking, 'accepted')}>{t.accept}</Button>
                </>
              )}
              {booking.status === 'accepted' && (
                <Button variant="secondary" disabled={!!isUpdating} className="w-full h-11 text-[7px] font-black uppercase rounded-xl" onClick={() => updateStatus(booking, 'completed')}>{t.finalizeCut}</Button>
              )}
            </div>
          )}
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-32 animate-lux-fade overflow-x-hidden w-full max-w-full">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <section className="bg-zinc-950 border border-white/10 p-6 xs:p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-start gap-6 relative overflow-hidden mx-0.5">
        <div className="flex flex-col items-start gap-4 text-left w-full">
          <div className="w-12 h-12 bg-emerald-500 rounded-[1.25rem] flex items-center justify-center shadow-xl">
            <Wallet className="text-black" size={24} />
          </div>
          <div className="space-y-1 w-full min-w-0">
            <p className="text-emerald-500/60 text-[7.5px] xs:text-[8px] font-black uppercase tracking-[0.4em] truncate">{t.equity}</p>
            <h2 className="text-2xl xs:text-4xl font-black text-emerald-400 italic tracking-tighter leading-none truncate">{barberShare.toFixed(2)}€</h2>
          </div>
        </div>
        <div className="w-full pt-6 border-t border-white/5 flex flex-col items-start gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={12} className="text-zinc-700" />
            <span className="text-[7px] xs:text-[7.5px] font-black text-zinc-600 uppercase tracking-widest">Performance Metrics</span>
          </div>
          <div className="flex gap-4 w-full">
            <VelocityScale label="Dan" value={stats.daily} max={10} />
            <VelocityScale label="Mjesec" value={stats.monthly} max={100} />
            <VelocityScale label="Godina" value={stats.yearly} max={1000} />
          </div>
        </div>
      </section>

      <div className="flex bg-zinc-950 p-1.5 rounded-[2rem] border border-white/5 mx-0.5">
        {(['pending', 'active', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-[7.5px] font-black uppercase tracking-wider rounded-xl transition-all relative truncate ${activeTab === tab ? 'bg-white text-black shadow-xl' : 'text-zinc-700'}`}>
            {tab === 'pending' ? 'Zahtjevi' : tab === 'active' ? 'Prihvaćeno' : 'Povijest'}
            {tab === 'pending' && pendingBookings.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black border-2 border-black animate-bounce shadow-xl">{pendingBookings.length}</span>
            )}
          </button>
        ))}
      </div>

      <section className="space-y-4 px-0.5">
        {activeTab === 'pending' && pendingBookings.length === 0 && <div className="py-24 text-center opacity-20 text-[9px] font-black uppercase tracking-widest italic">Nema novih zahtjeva</div>}
        {activeTab === 'pending' && pendingBookings.map(renderBookingCard)}
        {activeTab === 'active' && activeBookings.length === 0 && <div className="py-24 text-center opacity-20 text-[9px] font-black uppercase tracking-widest italic">Nema aktivnih termina</div>}
        {activeTab === 'active' && activeBookings.map(renderBookingCard)}
        {activeTab === 'history' && completedBookings.length === 0 && <div className="py-24 text-center opacity-20 text-[9px] font-black uppercase tracking-widest italic">Povijest je prazna</div>}
        {activeTab === 'history' && completedBookings.map(renderBookingCard)}
      </section>
    </div>
  );
};

export default BarberDashboard;
