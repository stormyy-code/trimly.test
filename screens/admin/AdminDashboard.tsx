
import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../../store/database';
import { Card, Button, Badge, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { BarChart3, TrendingUp, DollarSign, Wallet, ArrowUpRight, RefreshCw, Loader2, Scissors, Users, LogOut, CheckCircle2 } from 'lucide-react';
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
      // Povlačimo svježe podatke izravno s clouda
      await Promise.all([
        db.getBookings(),
        db.getBarbers(),
        db.getUsers()
      ]);
      setRefresh(prev => prev + 1);
    } catch (err) {
      setToast({ msg: 'Greška pri sinkronizaciji.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEverything();

    // REAL-TIME: Slušaj promjene na svim bookingzima
    const channel = supabase
      .channel('admin-finance-monitor')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookings' 
      }, () => {
        // Čim se bilo koji booking promijeni (npr. iz 'accepted' u 'completed'), 
        // ponovno povuci podatke da statistika bude točna.
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

  const data = useMemo(() => {
    // Filtriramo isključivo COMPLETED termine za financije
    const completedBookings = db.getBookingsSync().filter(b => b.status === 'completed');
    const allBarbers = db.getBarbersSync();

    const totalGross = completedBookings.reduce((sum, b) => sum + b.price, 0);
    const totalAdminComm = totalGross * APP_CONFIG.ADMIN_COMMISSION;

    // Detaljni izvještaj po barberu
    const breakdown = allBarbers.map(barber => {
      const bBookings = completedBookings.filter(b => b.barberId === barber.id);
      const bGross = bBookings.reduce((sum, b) => sum + b.price, 0);
      const bAdminPart = bGross * APP_CONFIG.ADMIN_COMMISSION;
      
      return {
        id: barber.id,
        name: barber.fullName,
        pic: barber.profilePicture,
        count: bBookings.length,
        gross: bGross,
        adminFee: bAdminPart
      };
    }).sort((a, b) => b.gross - a.gross);

    const stats = {
      today: completedBookings.filter(b => b.date === new Date().toISOString().split('T')[0]).length,
      activeBarbers: allBarbers.filter(b => b.approved).length
    };

    return { totalGross, totalAdminComm, breakdown, stats };
  }, [refresh]);

  return (
    <div className="space-y-8 animate-slide-up pb-32">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Glavne Financije */}
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
        <div className="text-center">
          <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">FINANCIJE</h2>
          <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em] mt-2">Mrežni sustav • Real-time</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-1">
        <Card className="p-8 bg-zinc-950 border-white/5 space-y-4">
          <div className="flex items-center gap-3">
             <DollarSign size={14} className="text-zinc-600" />
             <p className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Ukupan Bruto</p>
          </div>
          <p className="text-3xl font-black text-white italic tracking-tighter leading-none">{data.totalGross}€</p>
        </Card>
        <Card className="p-8 bg-emerald-500/10 border-emerald-500/20 space-y-4 shadow-[0_20px_40px_rgba(16,185,129,0.1)]">
          <div className="flex items-center gap-3">
             <TrendingUp size={14} className="text-emerald-500" />
             <p className="text-[9px] uppercase font-black tracking-widest text-emerald-500">Provizija (10%)</p>
          </div>
          <p className="text-3xl font-black text-emerald-400 italic tracking-tighter leading-none">{data.totalAdminComm.toFixed(2)}€</p>
        </Card>
      </div>

      {/* Obračun po barberu */}
      <section className="space-y-4 px-1">
        <div className="flex items-center gap-3 ml-4">
           <Wallet size={14} className="text-[#D4AF37]" />
           <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">ZARADA PO BARBERU</h3>
        </div>
        <div className="space-y-3">
           {data.breakdown.length === 0 ? (
             <div className="py-20 text-center opacity-20 text-[10px] font-black uppercase tracking-widest italic">Nema aktivnosti</div>
           ) : data.breakdown.map(barber => (
             <Card key={barber.id} className="p-6 bg-zinc-950 border-white/5 flex items-center gap-5 rounded-[2.5rem]">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/5 shrink-0 bg-zinc-900">
                   <img src={barber.pic} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                   <h4 className="font-black text-sm text-white uppercase italic tracking-tighter truncate leading-none">{barber.name}</h4>
                   <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1.5">{barber.count} završenih šišanja</p>
                </div>
                <div className="text-right">
                   <div className="text-xs font-black text-white italic">{barber.gross}€ <span className="text-[8px] text-zinc-600 font-bold not-italic">(BRUTO)</span></div>
                   <div className="flex items-center justify-end gap-1 text-emerald-500 mt-1">
                      <ArrowUpRight size={10} />
                      <span className="text-[10px] font-black">{barber.adminFee.toFixed(2)}€ <span className="text-[7px] text-emerald-500/50 uppercase tracking-tighter">NETO ADMIN</span></span>
                   </div>
                </div>
             </Card>
           ))}
        </div>
      </section>

      <section className="space-y-4 px-1">
        <div className="flex items-center gap-3 ml-4">
           <CheckCircle2 size={14} className="text-[#D4AF37]" />
           <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">MREŽNA STATISTIKA</h3>
        </div>
        <Card className="p-8 bg-black border border-white/5">
           <div className="flex justify-around items-center gap-8">
              <div className="text-center">
                 <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Danas šišanja</p>
                 <span className="text-xl font-black text-white italic">{data.stats.today}</span>
              </div>
              <div className="w-px h-8 bg-zinc-900"></div>
              <div className="text-center">
                 <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Aktivni Barberi</p>
                 <span className="text-xl font-black text-white italic">{data.stats.activeBarbers}</span>
              </div>
           </div>
        </Card>
      </section>

      <div className="px-1 pt-4">
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
