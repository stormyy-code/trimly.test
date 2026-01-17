
import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../../store/database';
import { Card, Button, Badge, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { BarChart3, TrendingUp, ShieldCheck, CalendarDays, Zap, CheckCircle2, LogOut, Users, Scissors, DollarSign, Wallet, ArrowUpRight, RefreshCw, Loader2 } from 'lucide-react';
import { APP_CONFIG } from '../../constants';
import { supabase } from '../../store/supabase';

interface AdminDashboardProps {
  lang: Language;
  onLogout?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang, onLogout }) => {
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const t = translations[lang];

  const fetchEverything = async () => {
    setLoading(true);
    try {
      // Povlačimo sve ključne podatke s Clouda
      await Promise.all([
        db.getBookings(),
        db.getBarbers(),
        db.getUsers()
      ]);
      setRefresh(prev => prev + 1);
    } catch (err) {
      setToast({ msg: 'Greška pri sinkronizaciji podataka.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEverything();

    // Slušamo promjene na bookingzima u realnom vremenu
    const channel = supabase
      .channel('admin-realtime-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        // Kada se bilo koji booking promijeni (npr. postane completed), osvježi podatke
        db.getBookings().then(() => setRefresh(prev => prev + 1));
      })
      .subscribe();

    const handleSync = () => setRefresh(prev => prev + 1);
    window.addEventListener('app-sync-complete', handleSync);
    
    return () => {
      window.removeEventListener('app-sync-complete', handleSync);
      supabase.removeChannel(channel);
    };
  }, []);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);

  const data = useMemo(() => {
    const rawBookings = db.getBookingsSync().filter(b => b.status === 'completed');
    const rawBarbers = db.getBarbersSync();

    const gross = rawBookings.reduce((sum, b) => sum + b.price, 0);
    const revenue = gross * APP_CONFIG.ADMIN_COMMISSION;

    // Detaljan izračun po svakom barberu
    const barberBreakdown = rawBarbers.map(barber => {
      const bBookings = rawBookings.filter(b => b.barberId === barber.id);
      const bGross = bBookings.reduce((sum, b) => sum + b.price, 0);
      const bComm = bGross * APP_CONFIG.ADMIN_COMMISSION;
      
      return {
        id: barber.id,
        name: barber.fullName,
        pic: barber.profilePicture,
        totalCuts: bBookings.length,
        gross: bGross,
        commission: bComm
      };
    }).sort((a, b) => b.gross - a.gross);

    const stats = {
      daily: rawBookings.filter(b => b.date === todayStr).length,
      monthly: rawBookings.filter(b => b.date.startsWith(monthStr)).length,
      totalBarbers: rawBarbers.length,
      pendingBarbers: rawBarbers.filter(b => !b.approved).length
    };

    return { totalGross: gross, adminRevenue: revenue, networkStats: stats, barberBreakdown };
  }, [refresh, todayStr, monthStr]);

  const VelocityScale = ({ label, value, max }: { label: string, value: number, max: number }) => (
    <div className="flex-1 flex flex-col items-center gap-3">
      <div className="text-center space-y-1 w-full">
        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-[0.2em] block w-full">{label}</span>
        <span className="text-sm font-black text-white block leading-none w-full">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5 px-0.5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className={`h-full flex-1 transition-all duration-1000 ${i < (value / (max/8 || 1)) ? 'bg-[#D4AF37]' : 'bg-white/5'}`} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-slide-up pb-32">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="premium-blur bg-zinc-900/40 rounded-[3rem] p-10 border border-white/10 ios-shadow flex flex-col items-center gap-6 relative overflow-hidden">
        <button 
          onClick={fetchEverything} 
          className="absolute top-6 right-6 p-3 bg-white/5 rounded-xl text-[#D4AF37] active:rotate-180 transition-all duration-500"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
        <div className="w-16 h-16 bg-[#D4AF37] rounded-[2rem] flex items-center justify-center text-black shadow-[0_20px_50px_rgba(212,175,55,0.3)]">
          <BarChart3 size={32} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Network Command</h2>
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.3em]">System Live • Zagreb Central</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-1">
        <Card className="p-8 bg-zinc-950 border-white/5 space-y-4">
          <div className="flex items-center gap-3">
             <DollarSign size={14} className="text-zinc-600" />
             <p className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Mrežni Promet</p>
          </div>
          <p className="text-3xl font-black text-white italic tracking-tighter leading-none">{data.totalGross}€</p>
        </Card>
        <Card className="p-8 bg-emerald-500/10 border-emerald-500/20 space-y-4 shadow-[0_20px_40px_rgba(16,185,129,0.1)]">
          <div className="flex items-center gap-3">
             <TrendingUp size={14} className="text-emerald-500" />
             <p className="text-[9px] uppercase font-black tracking-widest text-emerald-500">Provizija (10%)</p>
          </div>
          <p className="text-3xl font-black text-emerald-400 italic tracking-tighter leading-none">{data.adminRevenue.toFixed(2)}€</p>
        </Card>
      </div>

      <section className="space-y-4 px-1">
        <div className="flex items-center justify-between px-4">
           <div className="flex items-center gap-3">
              <Wallet size={14} className="text-[#D4AF37]" />
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Obračun po barberu</h3>
           </div>
        </div>
        <div className="space-y-3">
           {data.barberBreakdown.length === 0 ? (
             <div className="py-20 text-center opacity-20 text-[10px] font-black uppercase tracking-widest italic">Nema financijskih aktivnosti</div>
           ) : data.barberBreakdown.map(barber => (
             <Card key={barber.id} className="p-6 bg-zinc-950 border-white/5 flex items-center gap-5 rounded-[2.5rem]">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/5 shrink-0 bg-zinc-900">
                   <img src={barber.pic} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                   <h4 className="font-black text-sm text-white uppercase italic tracking-tighter truncate">{barber.name}</h4>
                   <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{barber.totalCuts} šišanja</span>
                   </div>
                </div>
                <div className="text-right space-y-1">
                   <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs font-black text-white italic">{barber.gross}€</span>
                   </div>
                   <div className="flex items-center justify-end gap-1 text-emerald-500">
                      <ArrowUpRight size={10} />
                      <span className="text-[10px] font-black">{barber.commission.toFixed(2)}€</span>
                   </div>
                </div>
             </Card>
           ))}
        </div>
      </section>

      <section className="space-y-4 px-1">
        <div className="flex items-center gap-3 px-4">
           <Zap size={14} className="text-[#D4AF37]" />
           <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Mrežni Protok</h3>
        </div>
        <Card className="p-8 bg-black border border-white/5">
          <div className="flex gap-10 justify-around items-center">
            <VelocityScale label="Danas" value={data.networkStats.daily} max={20} />
            <VelocityScale label="Mjesec" value={data.networkStats.monthly} max={200} />
            <VelocityScale label="Aktivni" value={data.networkStats.totalBarbers} max={50} />
          </div>
        </Card>
      </section>

      <div className="px-1 pt-4 space-y-4">
        <Button 
          variant="danger" 
          className="w-full h-18 text-[11px] font-black tracking-widest border-red-500/20" 
          onClick={onLogout}
        >
          <LogOut size={16} className="mr-3" /> ODJAVI SE IZ SUSTAVA
        </Button>
      </div>
    </div>
  );
};

export default AdminDashboard;
