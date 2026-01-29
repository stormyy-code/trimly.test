
import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../../store/database';
import { Card, Button, Badge, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { BarChart3, TrendingUp, DollarSign, Wallet, RefreshCw, List, LayoutGrid, LogOut } from 'lucide-react';
import { APP_CONFIG } from '../../constants';
import { supabase } from '../../store/supabase';

interface AdminDashboardProps {
  lang: Language;
  onLogout?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang, onLogout }) => {
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'stats' | 'report'>('stats');
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const t = translations[lang];

  const fetchEverything = async () => {
    setLoading(true);
    try {
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
    const channel = supabase
      .channel('admin-finance-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        db.getBookings().then(() => setRefresh(prev => prev + 1));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const data = useMemo(() => {
    const completedBookings = db.getBookingsSync().filter(b => b.status === 'completed');
    const allBarbers = db.getBarbersSync();
    const totalGross = completedBookings.reduce((sum, b) => sum + b.price, 0);
    const totalAdminComm = totalGross * APP_CONFIG.ADMIN_COMMISSION;

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
        adminFee: bAdminPart,
        netBarber: bGross - bAdminPart
      };
    }).sort((a, b) => b.gross - a.gross);

    const stats = {
      today: completedBookings.filter(b => b.date === new Date().toISOString().split('T')[0]).length,
      activeBarbers: allBarbers.filter(b => b.approved).length
    };
    return { totalGross, totalAdminComm, breakdown, stats };
  }, [refresh]);

  return (
    <div className="space-y-8 animate-slide-up pb-32 max-w-full overflow-x-hidden">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="premium-blur bg-zinc-900/40 rounded-[3rem] p-8 xs:p-10 border border-white/10 ios-shadow flex flex-col items-center gap-6 relative overflow-hidden">
        <button onClick={fetchEverything} className="absolute top-6 right-6 p-3 bg-white/5 rounded-xl text-[#D4AF37] active:rotate-180 transition-all duration-500">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
        <div className="w-16 h-16 bg-[#D4AF37] rounded-[2rem] flex items-center justify-center text-black shadow-[0_20px_50px_rgba(212,175,55,0.3)]">
          <BarChart3 size={32} />
        </div>
        <div className="text-center">
          <h2 className="text-3xl xs:text-4xl font-black text-white italic uppercase tracking-tighter">NETWORK FINANCE</h2>
          <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em] mt-2">Zagreb Barber System</p>
        </div>
      </div>

      <div className="flex bg-zinc-950 p-1.5 rounded-3xl border border-white/5 mx-1 shadow-2xl">
        <button onClick={() => setViewMode('stats')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${viewMode === 'stats' ? 'bg-white text-black' : 'text-zinc-600'}`}>
          <LayoutGrid size={14} /> Nadzorna ploča
        </button>
        <button onClick={() => setViewMode('report')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${viewMode === 'report' ? 'bg-white text-black' : 'text-zinc-600'}`}>
          <List size={14} /> Izvještaj
        </button>
      </div>

      {viewMode === 'stats' ? (
        <div className="space-y-8 animate-lux-fade">
          <div className="grid grid-cols-2 gap-4 px-1">
            <Card className="p-6 xs:p-8 bg-zinc-950 border-white/5 space-y-4">
              <div className="flex items-center gap-2"><DollarSign size={12} className="text-zinc-600" /><p className="text-[8px] uppercase font-black tracking-widest text-zinc-500">Ukupni Bruto</p></div>
              <p className="text-2xl xs:text-3xl font-black text-white italic tracking-tighter leading-none">{data.totalGross}€</p>
            </Card>
            <Card className="p-6 xs:p-8 bg-emerald-500/10 border-emerald-500/20 space-y-4 shadow-[0_20px_40px_rgba(16,185,129,0.1)]">
              <div className="flex items-center gap-2"><TrendingUp size={12} className="text-emerald-500" /><p className="text-[8px] uppercase font-black tracking-widest text-emerald-500">Neto Admin</p></div>
              <p className="text-2xl xs:text-3xl font-black text-emerald-400 italic tracking-tighter leading-none">{data.totalAdminComm.toFixed(2)}€</p>
            </Card>
          </div>

          <section className="space-y-4 px-1">
            <div className="flex items-center gap-3 ml-4">
               <Wallet size={14} className="text-[#D4AF37]" />
               <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">TOP BARBERI</h3>
            </div>
            <div className="space-y-3">
               {data.breakdown.slice(0, 3).map(barber => (
                 <Card key={barber.id} className="p-5 flex items-center gap-5 bg-zinc-950 border-white/5 rounded-[2rem]">
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/5 shrink-0 bg-zinc-900"><img src={barber.pic} className="w-full h-full object-cover" /></div>
                    <div className="flex-1 min-w-0"><h4 className="font-black text-xs text-white uppercase italic tracking-tighter truncate leading-none">{barber.name}</h4></div>
                    <div className="text-right text-xs font-black text-emerald-400 italic">{barber.gross}€</div>
                 </Card>
               ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="animate-lux-fade px-1">
           <Card className="p-0 bg-zinc-950 border-white/5 rounded-[2.5rem] overflow-hidden">
             <div className="w-full">
               <table className="w-full text-left border-collapse table-fixed">
                 <thead>
                   <tr className="bg-black border-b border-white/10">
                     <th className="p-4 xs:p-6 text-[8px] font-black text-zinc-500 uppercase tracking-widest w-[45%]">Barber</th>
                     <th className="p-4 xs:p-6 text-[8px] font-black text-[#D4AF37] uppercase tracking-widest text-right w-[27.5%]">Neto</th>
                     <th className="p-4 xs:p-6 text-[8px] font-black text-emerald-500 uppercase tracking-widest text-right w-[27.5%]">Prov.</th>
                   </tr>
                 </thead>
                 <tbody>
                   {data.breakdown.length === 0 ? (
                     <tr><td colSpan={3} className="p-16 text-center text-[10px] font-black text-zinc-800 uppercase tracking-widest italic">Nema podataka</td></tr>
                   ) : data.breakdown.map(b => (
                     <tr key={b.id} className="border-b border-white/[0.03] active:bg-white/[0.02] transition-colors">
                       <td className="p-4 xs:p-6 overflow-hidden">
                         <div className="flex items-center gap-3 min-w-0">
                           <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0 hidden xs:block">
                              <img src={b.pic} className="w-full h-full object-cover" />
                           </div>
                           <div className="min-w-0">
                             <span className="text-[10px] xs:text-[11px] font-black text-white uppercase italic truncate block">{b.name.split(' ')[0]}</span>
                             <span className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest block truncate">{b.count} šiš.</span>
                           </div>
                         </div>
                       </td>
                       <td className="p-4 xs:p-6 text-right overflow-hidden">
                          <span className="text-xs xs:text-sm font-black text-white italic leading-none whitespace-nowrap">{b.netBarber.toFixed(2)}€</span>
                       </td>
                       <td className="p-4 xs:p-6 text-right overflow-hidden">
                          <span className="text-xs xs:text-sm font-black text-emerald-500 italic leading-none whitespace-nowrap">{b.adminFee.toFixed(2)}€</span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </Card>
           
           <div className="mt-8 px-6 py-5 bg-zinc-900/50 border border-white/5 rounded-3xl">
              <div className="flex justify-between items-center text-zinc-500">
                <span className="text-[8px] font-black uppercase tracking-[0.2em]">Ukupni promet mreže:</span>
                <span className="text-xs font-black text-white italic">{data.totalGross.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#D4AF37]">Ukupna provizija (Admin):</span>
                <span className="text-sm font-black text-emerald-400 italic">{data.totalAdminComm.toFixed(2)}€</span>
              </div>
           </div>

           <p className="mt-6 px-6 text-[7px] text-zinc-700 font-bold uppercase text-center leading-relaxed italic tracking-widest">
             * Neto zarada barbera je nakon oduzetih {APP_CONFIG.ADMIN_COMMISSION * 100}% provizije.
           </p>
        </div>
      )}

      <div className="px-1 pt-4 pb-12">
        <Button variant="danger" className="w-full h-18 text-[11px] font-black tracking-widest border-red-500/20" onClick={onLogout}>
          <LogOut size={16} className="mr-3" /> ODJAVI SE IZ SUSTAVA
        </Button>
      </div>
    </div>
  );
};

export default AdminDashboard;
