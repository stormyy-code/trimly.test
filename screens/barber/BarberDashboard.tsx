
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../store/database';
import { supabase } from '../../store/supabase';
import { Booking, User } from '../../types';
import { Card, Badge, Button, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Wallet, User as UserIcon, TrendingUp, Users, Clock, Calendar, Search, Loader2, UserX } from 'lucide-react';
import { APP_CONFIG } from '../../constants';

interface BarberDashboardProps {
  barberId: string;
  lang: Language;
}

const VelocityScale = ({ label, value, max }: { label: string, value: number, max: number }) => (
  <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
    <div className="w-full min-w-0">
      <span className="text-[7px] font-black text-[#C5A059] uppercase tracking-[0.2em] block truncate">{label}</span>
      <span className="text-[12px] font-black text-white block truncate leading-none mt-1">{value}</span>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5 px-0.5 items-center">
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`h-full flex-1 rounded-sm transition-all duration-1000 ${i < (value / (max/6 || 1)) ? 'bg-[#C5A059]' : 'bg-zinc-900'}`} />
      ))}
    </div>
  </div>
);

const BarberDashboard: React.FC<BarberDashboardProps> = ({ barberId, lang }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history' | 'clients'>('pending');
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

  const { pendingBookings, activeBookings, completedBookings, stats, barberShare, competitionCounts, clientList } = useMemo(() => {
    const rawBookings = db.getBookingsSync().filter(b => b.barberId === barberId);

    const chronoSort = (a: Booking, b: Booking) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    };

    const pending = rawBookings.filter(b => b.status === 'pending').sort(chronoSort);
    const active = rawBookings.filter(b => b.status === 'accepted').sort(chronoSort);
    const history = rawBookings.filter(b => ['completed', 'rejected', 'cancelled', 'no-show'].includes(b.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const compMap: Record<string, number> = {};
    pending.forEach(b => {
      const key = `${b.date}_${b.time}`;
      compMap[key] = (compMap[key] || 0) + 1;
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const completed = rawBookings.filter(b => b.status === 'completed');
    
    const clientCounts: Record<string, number> = {};
    completed.forEach(b => {
      clientCounts[b.customerId] = (clientCounts[b.customerId] || 0) + 1;
    });

    const aggregatedClients = Object.entries(clientCounts).map(([id, count]) => {
      const u = allUsers.find(user => user.id === id);
      return {
        id,
        count,
        name: u?.fullName || 'Klijent',
        avatar: u?.avatarUrl,
        email: u?.email
      };
    }).sort((a, b) => b.count - a.count);

    const velocity = {
      daily: completed.filter(b => b.date === todayStr).length,
      monthly: completed.length,
      yearly: completed.length,
    };

    const gross = completed.reduce((sum, b) => sum + b.price, 0);
    const share = gross * APP_CONFIG.BARBER_SHARE;

    return { 
      pendingBookings: pending, 
      activeBookings: active, 
      completedBookings: history, 
      stats: velocity, 
      barberShare: share, 
      competitionCounts: compMap,
      clientList: aggregatedClients
    };
  }, [barberId, refreshTrigger, allUsers]);

  const updateStatus = async (booking: Booking, status: Booking['status']) => {
    setIsUpdating(booking.id);
    if (status === 'accepted') {
      const collisions = pendingBookings.filter(b => b.id !== booking.id && b.date === booking.date && b.time === booking.time);
      for (const coll of collisions) {
        await db.updateBookingStatus(coll.id, 'rejected');
      }
      setToast({ msg: lang === 'hr' ? 'Termin potvrđen!' : 'Confirmed!', type: 'success' });
    }
    const result = await db.updateBookingStatus(booking.id, status);
    if (result.success) {
      if (status !== 'accepted') setToast({ msg: lang === 'hr' ? 'Ažurirano!' : 'Updated!', type: 'success' });
      await refreshAll();
    } else {
      setToast({ msg: 'Greška!', type: 'error' });
    }
    setIsUpdating(null);
  };

  const renderBookingCard = (booking: Booking) => {
    const isCancelled = booking.status === 'cancelled';
    const isNoShow = booking.status === 'no-show';
    const isInactive = isCancelled || isNoShow || booking.status === 'rejected';
    const client = allUsers.find(u => u.id === booking.customerId);
    const displayName = client?.fullName || booking.customerName || 'Klijent';
    const competitionKey = `${booking.date}_${booking.time}`;
    const compCount = competitionCounts[competitionKey] || 0;
    const hasCompetition = compCount > 1;
    
    return (
      <div key={booking.id} className="relative mt-2">
        {hasCompetition && booking.status === 'pending' && (
          <div className="absolute -top-3 right-4 z-30 bg-amber-500 text-black text-[7px] font-black px-2 py-0.5 rounded-full shadow-lg border border-black flex items-center gap-1">
            <Users size={8} /> {compCount} KANDIDATA
          </div>
        )}

        <Card className={`p-5 border-white/5 bg-zinc-950 rounded-[2rem] space-y-4 relative overflow-hidden text-left flex flex-col items-start ${isInactive ? 'opacity-50 grayscale' : ''} ${hasCompetition && booking.status === 'pending' ? 'border-amber-500/20' : ''}`}>
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
                <h3 className="font-black text-sm text-white uppercase italic tracking-tighter leading-tight truncate">{displayName}</h3>
                <p className="text-[7.5px] text-zinc-600 font-black uppercase tracking-widest mt-1.5 truncate">{booking.serviceName}</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end shrink-0">
              <span className="block font-black text-base text-white italic tracking-tighter leading-none mb-1">{booking.price}€</span>
              <Badge variant={isInactive ? 'error' : booking.status === 'pending' ? 'warning' : 'success'} className="text-[6px] px-1.5 py-0.5">
                {isCancelled ? 'OTKAZANO' : isNoShow ? 'NIJE DOŠAO' : booking.status.toUpperCase()}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-px bg-white/5 rounded-2xl border border-white/5 w-full overflow-hidden">
            <div className="bg-black/40 p-3 flex flex-col items-start min-w-0">
              <div className="flex items-center gap-1.5 opacity-40 mb-1">
                <Calendar size={8} className="text-[#C5A059]" />
                <p className="text-[6px] text-zinc-400 font-black uppercase tracking-widest">Datum</p>
              </div>
              <span className="text-[9px] font-black text-white truncate">{formatDate(booking.date)}</span>
            </div>
            <div className="bg-black/40 p-3 flex flex-col items-start min-w-0 border-l border-white/5">
              <div className="flex items-center gap-1.5 opacity-40 mb-1">
                <Clock size={8} className="text-[#C5A059]" />
                <p className="text-[6px] text-zinc-400 font-black uppercase tracking-widest">Vrijeme</p>
              </div>
              <span className="text-[9px] font-black text-white truncate">{booking.time}h</span>
            </div>
          </div>

          {!isInactive && booking.status !== 'completed' && (
            <div className="flex gap-2 w-full">
              {booking.status === 'pending' && (
                <>
                  <button disabled={!!isUpdating} className="flex-1 h-11 bg-zinc-900 text-zinc-500 rounded-xl text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all" onClick={() => updateStatus(booking, 'rejected')}>Odbij</button>
                  <Button variant="primary" disabled={!!isUpdating} className="flex-[2] h-11 text-[8px] uppercase font-black rounded-xl" onClick={() => updateStatus(booking, 'accepted')}>Prihvati</Button>
                </>
              )}
              {booking.status === 'accepted' && (
                <>
                  <button disabled={!!isUpdating} className="flex-1 h-11 bg-red-500/10 text-red-500 rounded-xl text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5" onClick={() => updateStatus(booking, 'no-show')}>
                    <UserX size={12} /> {t.noShow}
                  </button>
                  <Button variant="primary" disabled={!!isUpdating} className="flex-[2] h-11 text-[8px] font-black uppercase rounded-xl" onClick={() => updateStatus(booking, 'completed')}>Završi Šišanje</Button>
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-32 animate-lux-fade w-full max-w-full overflow-x-hidden">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <section className="bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-start gap-6 relative overflow-hidden mx-1">
        <div className="flex flex-col items-start gap-4 text-left w-full">
          <div className="w-12 h-12 bg-emerald-500 rounded-[1.25rem] flex items-center justify-center shadow-xl">
            <Wallet className="text-black" size={24} />
          </div>
          <div className="space-y-1 w-full min-w-0">
            <p className="text-emerald-500/60 text-[8px] font-black uppercase tracking-[0.4em] truncate">Tvoja Neto Zarada</p>
            <h2 className="text-3xl font-black text-emerald-400 italic tracking-tighter leading-none truncate">{barberShare.toFixed(2)}€</h2>
          </div>
        </div>
        <div className="w-full pt-6 border-t border-white/5 flex flex-col items-start gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={12} className="text-zinc-700" />
            <span className="text-[7.5px] font-black text-zinc-600 uppercase tracking-widest">Metrika uspješnosti</span>
          </div>
          <div className="flex gap-4 w-full">
            <VelocityScale label="DANAS" value={stats.daily} max={10} />
            <VelocityScale label="MJESEC" value={stats.monthly} max={100} />
            <VelocityScale label="UKUPNO" value={stats.yearly} max={1000} />
          </div>
        </div>
      </section>

      <div className="flex bg-zinc-950 p-1.5 rounded-[2rem] border border-white/5 mx-1 overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('pending')} className={`flex-1 py-3 px-4 text-[8px] font-black uppercase tracking-wider rounded-xl transition-all relative shrink-0 whitespace-nowrap ${activeTab === 'pending' ? 'bg-white text-black shadow-xl' : 'text-zinc-700'}`}>
          Zahtjevi
          {pendingBookings.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black border-2 border-black animate-bounce">{pendingBookings.length}</span>
          )}
        </button>
        <button onClick={() => setActiveTab('active')} className={`flex-1 py-3 px-4 text-[8px] font-black uppercase tracking-wider rounded-xl transition-all shrink-0 whitespace-nowrap ${activeTab === 'active' ? 'bg-white text-black shadow-xl' : 'text-zinc-700'}`}>Aktivni</button>
        <button onClick={() => setActiveTab('clients')} className={`flex-1 py-3 px-4 text-[8px] font-black uppercase tracking-wider rounded-xl transition-all shrink-0 whitespace-nowrap ${activeTab === 'clients' ? 'bg-white text-black shadow-xl' : 'text-zinc-700'}`}>Klijenti</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 px-4 text-[8px] font-black uppercase tracking-wider rounded-xl transition-all shrink-0 whitespace-nowrap ${activeTab === 'history' ? 'bg-white text-black shadow-xl' : 'text-zinc-700'}`}>Povijest</button>
      </div>

      <section className="space-y-4 px-1">
        {activeTab === 'pending' && (
          <>
            {pendingBookings.length === 0 && <div className="py-24 text-center opacity-20 text-[9px] font-black uppercase tracking-widest italic">Nema novih upita</div>}
            {pendingBookings.map(renderBookingCard)}
          </>
        )}
        
        {activeTab === 'active' && (
          <>
            {activeBookings.length === 0 && <div className="py-24 text-center opacity-20 text-[9px] font-black uppercase tracking-widest italic">Nema aktivnih termina</div>}
            {activeBookings.map(renderBookingCard)}
          </>
        )}

        {activeTab === 'clients' && (
          <div className="space-y-3">
             <div className="flex items-center gap-2 px-4 mb-2">
                <Users size={12} className="text-[#C5A059]" />
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Baza tvojih klijenta ({clientList.length})</span>
             </div>
             {clientList.length === 0 ? (
               <div className="py-24 text-center opacity-20 text-[9px] font-black uppercase tracking-widest italic">Još nemaš povijest klijenta</div>
             ) : clientList.map(c => (
               <Card key={c.id} className="p-4 bg-zinc-950 border-white/5 flex items-center justify-between gap-4 rounded-[1.75rem]">
                 <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 shrink-0">
                       {c.avatar ? <img src={c.avatar} className="w-full h-full object-cover" /> : <UserIcon size={18} className="text-zinc-700 m-auto" />}
                    </div>
                    <div className="min-w-0">
                       <h4 className="text-sm font-black text-white italic truncate leading-none mb-1.5">{c.name}</h4>
                       <p className="text-[7.5px] text-zinc-600 font-black uppercase tracking-widest truncate">{c.email}</p>
                    </div>
                 </div>
                 <div className="shrink-0">
                    <Badge variant="gold" className="text-[8px] px-3 py-1 font-black">{c.count} dolazaka</Badge>
                 </div>
               </Card>
             ))}
          </div>
        )}

        {activeTab === 'history' && (
          <>
            {completedBookings.length === 0 && <div className="py-24 text-center opacity-20 text-[9px] font-black uppercase tracking-widest italic">Povijest je prazna</div>}
            {completedBookings.map(renderBookingCard)}
          </>
        )}
      </section>
    </div>
  );
};

export default BarberDashboard;
