
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../store/database';
import { supabase } from '../../store/supabase';
import { Booking, User } from '../../types';
import { Card, Badge, Button, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Wallet, User as UserIcon, TrendingUp, Users, Clock, Calendar, Search, Loader2, UserX, Filter } from 'lucide-react';
import { APP_CONFIG } from '../../constants';

interface BarberDashboardProps {
  barberId: string;
  lang: Language;
}

type TimeFilter = 'today' | 'tomorrow' | 'week' | 'all';

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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
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
    const channel = supabase.channel('barber-dashboard-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `barber_id=eq.${barberId}` }, () => {
      refreshAll();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [barberId]);

  const { filteredPending, filteredActive, totalPendingCount, totalActiveCount, stats, barberShare, clientList } = useMemo(() => {
    const rawBookings = db.getBookingsSync().filter(b => b.barberId === barberId);
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);

    const chronoSort = (a: Booking, b: Booking) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    };

    const applyFilter = (list: Booking[]) => {
      if (timeFilter === 'all') return list;
      return list.filter(b => {
        if (timeFilter === 'today') return b.date === todayStr;
        if (timeFilter === 'tomorrow') return b.date === tomorrowStr;
        if (timeFilter === 'week') {
          const bDate = new Date(b.date);
          return bDate >= now && bDate <= nextWeek;
        }
        return true;
      });
    };

    const allPendingRaw = rawBookings.filter(b => b.status === 'pending');
    const allActiveRaw = rawBookings.filter(b => b.status === 'accepted');

    const pending = applyFilter(allPendingRaw).sort(chronoSort);
    const active = applyFilter(allActiveRaw).sort(chronoSort);
    
    const completed = rawBookings.filter(b => b.status === 'completed');
    const gross = completed.reduce((sum, b) => sum + (Number(b.price) || 0), 0);
    const share = gross * APP_CONFIG.BARBER_SHARE;

    const clientCounts: Record<string, number> = {};
    completed.forEach(b => {
      clientCounts[b.customerId] = (clientCounts[b.customerId] || 0) + 1;
    });

    const aggregatedClients = Object.entries(clientCounts).map(([id, count]) => {
      const u = allUsers.find(user => user.id === id);
      return { id, count, name: u?.fullName || 'Klijent', avatar: u?.avatarUrl };
    }).sort((a, b) => b.count - a.count);

    return { 
      filteredPending: pending, 
      filteredActive: active,
      totalPendingCount: activeTab === 'pending' ? pending.length : allPendingRaw.length,
      totalActiveCount: activeTab === 'active' ? active.length : allActiveRaw.length,
      stats: {
        daily: completed.filter(b => b.date === todayStr).length,
        monthly: completed.length
      },
      barberShare: share,
      clientList: aggregatedClients
    };
  }, [barberId, refreshTrigger, allUsers, timeFilter, activeTab]);

  const updateStatus = async (booking: Booking, status: Booking['status']) => {
    setIsUpdating(booking.id);
    
    if (status === 'accepted') {
      const allBookings = db.getBookingsSync();
      const clashingRequests = allBookings.filter(b => 
        b.id !== booking.id && 
        b.barberId === barberId && 
        b.date === booking.date && 
        b.time === booking.time && 
        b.status === 'pending'
      );

      await Promise.all(clashingRequests.map(clash => db.updateBookingStatus(clash.id, 'rejected')));
    }

    const result = await db.updateBookingStatus(booking.id, status);
    
    if (result.success) {
      let message = '';
      
      if (status === 'accepted') {
        message = lang === 'hr' ? 'Zahtjev je prihvaćen!' : 'Request accepted!';
      } else if (status === 'rejected') {
        message = lang === 'hr' ? 'Zahtjev je odbijen!' : 'Request rejected!';
      } else if (status === 'completed') {
        message = lang === 'hr' ? 'Šišanje završeno!' : 'Haircut finished!';
      } else if (status === 'no-show') {
        message = lang === 'hr' ? 'Označeno No-Show' : 'Marked as No-Show';
      } else {
        message = lang === 'hr' ? 'Status ažuriran!' : 'Status updated!';
      }
      
      setToast({ msg: message, type: 'success' });
      await refreshAll();
    } else {
      setToast({ msg: lang === 'hr' ? 'Greška pri spremanju.' : 'Save error.', type: 'error' });
    }
    setIsUpdating(null);
  };

  const renderBookingCard = (booking: Booking) => {
    const client = allUsers.find(u => u.id === booking.customerId);
    const displayName = client?.fullName || booking.customerName || 'Klijent';
    
    return (
      <div key={booking.id} className="relative mt-3 w-full min-w-0">
        <Card className="p-4 sm:p-5 border-white/5 bg-zinc-950 rounded-[2rem] space-y-4 relative overflow-hidden flex flex-col items-start min-w-0">
          {isUpdating === booking.id && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center">
              <Loader2 className="animate-spin text-[#D4AF37]" size={24} />
            </div>
          )}
          
          <div className="flex justify-between items-center gap-4 w-full min-w-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="shrink-0 w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5 overflow-hidden">
                {client?.avatarUrl ? <img src={client.avatarUrl} className="w-full h-full object-cover" /> : <UserIcon size={20} className="text-zinc-700" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-sm text-white uppercase italic tracking-tighter leading-none truncate">{displayName}</h3>
                <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest mt-2 truncate break-words">{booking.serviceName}</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end shrink-0 ml-2">
              <span className="block font-black text-lg text-white italic tracking-tighter leading-none mb-1">{booking.price}€</span>
              <Badge variant={booking.status === 'pending' ? 'warning' : 'success'} className="text-[6px] px-1.5 py-0.5">
                {booking.status.toUpperCase()}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 w-full min-w-0">
            <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex flex-col items-start min-w-0">
              <div className="flex items-center gap-1.5 opacity-40 mb-1">
                <Calendar size={10} className="text-[#C5A059]" />
                <p className="text-[6px] text-zinc-400 font-black uppercase tracking-widest truncate">Datum</p>
              </div>
              <span className="text-[10px] font-black text-white truncate w-full">{formatDate(booking.date)}</span>
            </div>
            <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex flex-col items-start min-w-0">
              <div className="flex items-center gap-1.5 opacity-40 mb-1">
                <Clock size={10} className="text-[#C5A059]" />
                <p className="text-[6px] text-zinc-400 font-black uppercase tracking-widest truncate">Vrijeme</p>
              </div>
              <span className="text-[10px] font-black text-white truncate w-full">{booking.time}h</span>
            </div>
          </div>

          <div className="flex gap-2 w-full pt-1">
            {booking.status === 'pending' && (
              <>
                <button disabled={!!isUpdating} className="flex-1 h-12 bg-zinc-900 text-zinc-500 rounded-xl text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all truncate px-2" onClick={() => updateStatus(booking, 'rejected')}>Odbij</button>
                <Button variant="primary" disabled={!!isUpdating} className="flex-[2] h-12 text-[8px] uppercase font-black rounded-xl" onClick={() => updateStatus(booking, 'accepted')}>Prihvati</Button>
              </>
            )}
            {booking.status === 'accepted' && (
              <>
                <button disabled={!!isUpdating} className="flex-1 h-12 bg-red-500/10 text-red-500 rounded-xl text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5 px-2" onClick={() => updateStatus(booking, 'no-show')}>
                  <UserX size={12} className="shrink-0" /> <span className="truncate">NO SHOW</span>
                </button>
                <Button variant="primary" disabled={!!isUpdating} className="flex-[2] h-12 text-[8px] font-black uppercase rounded-xl" onClick={() => updateStatus(booking, 'completed')}>Završi</Button>
              </>
            )}
          </div>
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
            <p className="text-emerald-500/60 text-[8px] font-black uppercase tracking-[0.4em] truncate">Saldo</p>
            <h2 className="text-3xl font-black text-emerald-400 italic tracking-tighter leading-none truncate">{barberShare.toFixed(2)}€</h2>
          </div>
        </div>
        <div className="w-full pt-6 border-t border-white/5 flex flex-col items-start gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={12} className="text-zinc-700" />
            <span className="text-[7.5px] font-black text-zinc-600 uppercase tracking-widest">Metrika rada</span>
          </div>
          <div className="flex gap-4 w-full">
            <VelocityScale label="DANAS" value={stats.daily} max={10} />
            <VelocityScale label="MJESEC" value={stats.monthly} max={100} />
          </div>
        </div>
      </section>

      <div className="flex bg-zinc-950 p-1.5 rounded-[2rem] border border-white/5 mx-1 overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('pending')} className={`flex-1 py-3.5 px-4 text-[8px] font-black uppercase tracking-wider rounded-2xl transition-all relative shrink-0 whitespace-nowrap ${activeTab === 'pending' ? 'bg-white text-black shadow-xl' : 'text-zinc-700'}`}>
          Zahtjevi
          {totalPendingCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black border-2 border-black z-10 shadow-lg">
              {totalPendingCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('active')} className={`flex-1 py-3.5 px-4 text-[8px] font-black uppercase tracking-wider rounded-2xl transition-all shrink-0 whitespace-nowrap relative ${activeTab === 'active' ? 'bg-white text-black shadow-xl' : 'text-zinc-700'}`}>
          Aktivni
          {totalActiveCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#D4AF37] text-black w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black border-2 border-black z-10 shadow-lg">
              {totalActiveCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('clients')} className={`flex-1 py-3.5 px-4 text-[8px] font-black uppercase tracking-wider rounded-2xl transition-all shrink-0 whitespace-nowrap ${activeTab === 'clients' ? 'bg-white text-black shadow-xl' : 'text-zinc-700'}`}>Klijenti</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-3.5 px-4 text-[8px] font-black uppercase tracking-wider rounded-2xl transition-all shrink-0 whitespace-nowrap ${activeTab === 'history' ? 'bg-white text-black shadow-xl' : 'text-zinc-700'}`}>Povijest</button>
      </div>

      {(activeTab === 'pending' || activeTab === 'active') && (
        <div className="flex gap-2 mx-1 px-1 overflow-x-auto scrollbar-hide">
          {[
            { id: 'all', label: 'Sve' },
            { id: 'today', label: 'Danas' },
            { id: 'tomorrow', label: 'Sutra' },
            { id: 'week', label: 'Ovaj tjedan' }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setTimeFilter(filter.id as TimeFilter)}
              className={`px-4 py-2 rounded-full text-[7px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                timeFilter === filter.id 
                  ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-lg' 
                  : 'bg-zinc-900 border-white/5 text-zinc-500'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      <section className="space-y-2 px-1 w-full min-w-0">
        {activeTab === 'pending' && (
          <>
            {filteredPending.length === 0 && <div className="py-24 text-center opacity-20 text-[10px] font-black uppercase tracking-widest italic">Nema zahtjeva {timeFilter !== 'all' ? 'za odabrani period' : ''}</div>}
            {filteredPending.map(renderBookingCard)}
          </>
        )}
        {activeTab === 'active' && (
          <>
            {filteredActive.length === 0 && <div className="py-24 text-center opacity-20 text-[10px] font-black uppercase tracking-widest italic">Nema aktivnih termina {timeFilter !== 'all' ? 'za odabrani period' : ''}</div>}
            {filteredActive.map(renderBookingCard)}
          </>
        )}
        {activeTab === 'clients' && (
          <div className="space-y-3">
             {clientList.length === 0 ? (
               <div className="py-24 text-center opacity-20 text-[10px] font-black uppercase tracking-widest italic">Još nemaš bazu klijenata</div>
             ) : clientList.map(c => (
               <Card key={c.id} className="p-4 bg-zinc-950 border-white/5 flex items-center justify-between gap-4 rounded-[1.75rem] min-w-0">
                 <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shrink-0">
                       {c.avatar ? <img src={c.avatar} className="w-full h-full object-cover" /> : <UserIcon size={18} className="text-zinc-700 m-auto" />}
                    </div>
                    <div className="min-w-0 flex-1">
                       <h4 className="text-sm font-black text-white italic truncate leading-none mb-1.5">{c.name}</h4>
                    </div>
                 </div>
                 <div className="shrink-0">
                    <Badge variant="gold" className="text-[7px] px-3 py-1 font-black">{c.count} dolazaka</Badge>
                 </div>
               </Card>
             ))}
          </div>
        )}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {db.getBookingsSync()
              .filter(b => b.barberId === barberId && ['completed', 'rejected', 'cancelled', 'no-show'].includes(b.status))
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 20)
              .map(renderBookingCard)}
          </div>
        )}
      </section>
    </div>
  );
};

export default BarberDashboard;
