
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../store/database';
import { supabase } from '../../store/supabase';
import { Booking } from '../../types';
import { Card, Badge, Button } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Check, X, Wallet, Scissors, User as UserIcon, TrendingUp, CalendarDays, ShieldAlert, Bell, Loader2, Zap } from 'lucide-react';
import { APP_CONFIG } from '../../constants';

interface BarberDashboardProps {
  barberId: string;
  lang: Language;
}

const VelocityScale = ({ label, value, max }: { label: string, value: number, max: number }) => (
  <div className="flex-1 flex flex-col items-center gap-3 min-w-0">
    <div className="text-center space-y-0.5 w-full">
      <span className="text-[7px] font-black text-[#C5A059] uppercase tracking-widest block w-full text-center truncate">{label}</span>
      <span className="text-[11px] font-black text-white block w-full text-center truncate">{value}</span>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex gap-1 px-1">
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`h-full flex-1 rounded-sm transition-all duration-1000 ${i < (value / (max/6 || 1)) ? 'bg-[#C5A059]' : 'bg-transparent'}`} />
      ))}
    </div>
  </div>
);

const BarberDashboard: React.FC<BarberDashboardProps> = ({ barberId, lang }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history'>('pending');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const t = translations[lang];

  useEffect(() => {
    const handleSync = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('app-sync-complete', handleSync);
    
    // Eksplicitni fetch pri učitavanju za svježe podatke
    db.getBookings(barberId, 'barber');

    const channel = supabase
      .channel('barber-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `barberId=eq.${barberId}` }, () => {
        db.getBookings(barberId, 'barber');
      })
      .subscribe();
    
    return () => {
      window.removeEventListener('app-sync-complete', handleSync);
      supabase.removeChannel(channel);
    };
  }, [barberId]);

  const { pendingBookings, activeBookings, completedBookings, stats, barberShare } = useMemo(() => {
    const rawBookings = db.getBookingsSync().filter(b => b.barberId === barberId).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const pending = rawBookings.filter(b => b.status === 'pending');
    const active = rawBookings.filter(b => b.status === 'accepted');
    const history = rawBookings.filter(b => b.status === 'completed' || b.status === 'rejected');

    const todayStr = new Date().toISOString().split('T')[0];
    const completed = rawBookings.filter(b => b.status === 'completed');
    const velocity = {
      daily: completed.filter(b => b.date === todayStr).length,
      monthly: completed.length,
      yearly: completed.length,
    };

    const gross = completed.reduce((sum, b) => sum + b.price, 0);
    const share = gross * APP_CONFIG.BARBER_SHARE;

    return { pendingBookings: pending, activeBookings: active, completedBookings: history, stats: velocity, barberShare: share };
  }, [barberId, refreshTrigger]);

  const updateStatus = async (bookingId: string, status: Booking['status']) => {
    setIsUpdating(bookingId);
    
    // Pronađi ovaj booking da znamo datum i vrijeme
    const currentBooking = db.getBookingsSync().find(b => b.id === bookingId);
    
    const success = await db.updateBookingStatus(bookingId, status);
    
    if (success) {
      // Ako smo prihvatili termin, automatski odbijamo ostale klijente koji čekaju za ISTI termin
      if (status === 'accepted' && currentBooking) {
        const othersToReject = db.getBookingsSync().filter(b => 
          b.id !== bookingId &&
          b.barberId === barberId &&
          b.date === currentBooking.date &&
          b.time === currentBooking.time &&
          b.status === 'pending'
        );

        for (const b of othersToReject) {
          await db.updateBookingStatus(b.id, 'rejected');
        }
      }

      await db.getBookings(barberId, 'barber');
      setRefreshTrigger(prev => prev + 1);
    }
    setIsUpdating(null);
  };

  const renderBookingCard = (booking: Booking) => (
    <Card key={booking.id} className="p-6 border-white/5 bg-zinc-950 rounded-[2.5rem] space-y-6 relative overflow-hidden shadow-2xl">
      {isUpdating === booking.id && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center">
          <Loader2 className="animate-spin text-[#D4AF37]" size={24} />
        </div>
      )}
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="shrink-0 w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-[#C5A059] border border-white/5">
            <UserIcon size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-sm text-white uppercase italic tracking-tighter leading-none truncate">{booking.customerName || booking.customerEmail.split('@')[0]}</h3>
            <p className="text-[8px] text-zinc-600 font-black uppercase tracking-[0.2em] mt-2 truncate">{booking.serviceName}</p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
          <span className="block font-black text-2xl text-white italic tracking-tighter leading-none">{booking.price}€</span>
          <Badge variant={booking.status === 'pending' ? 'warning' : 'success'} className="text-[7px]">{booking.status}</Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 p-5 bg-black/40 rounded-3xl border border-white/[0.03]">
        <div className="text-center space-y-1 min-w-0">
          <p className="text-[7px] text-zinc-700 font-black uppercase tracking-widest truncate">Datum</p>
          <span className="text-[10px] font-black text-zinc-400 truncate">{booking.date}</span>
        </div>
        <div className="text-center border-l border-white/5 space-y-1 min-w-0">
          <p className="text-[7px] text-zinc-700 font-black uppercase tracking-widest truncate">Vrijeme</p>
          <span className="text-[10px] font-black text-zinc-400 truncate">{booking.time}h</span>
        </div>
      </div>

      <div className="flex gap-3">
        {booking.status === 'pending' && (
          <>
            <button className="flex-1 h-14 bg-zinc-800 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all" onClick={() => updateStatus(booking.id, 'rejected')}>{t.decline}</button>
            <Button variant="primary" className="flex-[2] h-14 text-[9px] uppercase font-black rounded-2xl shadow-2xl" onClick={() => updateStatus(booking.id, 'accepted')}>{t.accept}</Button>
          </>
        )}
        {booking.status === 'accepted' && (
          <Button variant="secondary" className="w-full h-14 text-[9px] font-black uppercase rounded-2xl border-emerald-500/20 text-emerald-500" onClick={() => updateStatus(booking.id, 'completed')}>{t.finalizeCut}</Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-8 pb-32 animate-lux-fade">
      <section className="bg-zinc-950 border border-white/10 p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
           <Zap size={20} className="text-emerald-500 opacity-20" />
        </div>
        <div className="flex flex-col items-center gap-5 text-center w-full">
          <div className="w-16 h-16 bg-emerald-500 rounded-[2rem] flex items-center justify-center shadow-[0_25px_50px_rgba(16,185,129,0.3)]">
            <Wallet className="text-black" size={28} />
          </div>
          <div className="space-y-2 w-full min-w-0">
            <p className="text-emerald-500/60 text-[10px] font-black uppercase tracking-[0.4em] flex items-center justify-center gap-2 w-full text-center truncate">
               {t.equity}
            </p>
            <h2 className="text-4xl xs:text-5xl font-black text-emerald-400 italic tracking-tighter leading-none w-full text-center break-words">{barberShare.toFixed(2)}€</h2>
          </div>
        </div>
        <div className="w-full pt-8 border-t border-white/5 space-y-6 flex flex-col items-center">
          <div className="flex items-center gap-2 w-full justify-center">
            <TrendingUp size={12} className="text-zinc-700" />
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] text-center truncate">{t.efficiencyStats}</span>
          </div>
          <div className="flex gap-4 xs:gap-8 w-full justify-center items-center">
            <VelocityScale label="Dan" value={stats.daily} max={10} />
            <VelocityScale label="Mjesec" value={stats.monthly} max={100} />
            <VelocityScale label="Godina" value={stats.yearly} max={1000} />
          </div>
        </div>
      </section>

      <div className="flex bg-zinc-950 p-2 rounded-[2rem] border border-white/5 mx-1">
        {(['pending', 'active', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-4 text-[8px] font-black uppercase tracking-widest rounded-2xl transition-all relative truncate ${activeTab === tab ? 'bg-white text-black shadow-2xl scale-100' : 'text-zinc-600 scale-95 opacity-60'}`}>
            {tab === 'pending' ? 'Zahtjevi' : tab === 'active' ? 'Aktivno' : 'Povijest'} 
            {tab === 'pending' && pendingBookings.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black shadow-xl border-2 border-black animate-bounce">{pendingBookings.length}</span>
            )}
          </button>
        ))}
      </div>

      <section className="space-y-6 px-1">
        {activeTab === 'pending' && pendingBookings.length === 0 && <div className="py-24 text-center opacity-20 text-[10px] font-black uppercase tracking-widest italic w-full">Nema novih zahtjeva</div>}
        {activeTab === 'pending' && pendingBookings.map(renderBookingCard)}
        {activeTab === 'active' && activeBookings.length === 0 && <div className="py-24 text-center opacity-20 text-[10px] font-black uppercase tracking-widest italic w-full">Nema aktivnih šišanja</div>}
        {activeTab === 'active' && activeBookings.map(renderBookingCard)}
        {activeTab === 'history' && completedBookings.length === 0 && <div className="py-24 text-center opacity-20 text-[10px] font-black uppercase tracking-widest italic w-full">Povijest je prazna</div>}
        {activeTab === 'history' && completedBookings.map(renderBookingCard)}
      </section>
    </div>
  );
};

export default BarberDashboard;
