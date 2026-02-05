
import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../../store/database';
import { Card, Button, Toast, Badge } from '../../components/UI';
import { translations, Language } from '../../translations';
import { BarChart3, TrendingUp, DollarSign, Wallet, RefreshCw, Scissors, CreditCard, ChevronRight } from 'lucide-react';
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
      await Promise.all([db.getBookings(), db.getBarbers(), db.getUsers()]);
      setRefresh(prev => prev + 1);
    } catch (err) {
      setToast({ msg: 'Greška pri sinkronizaciji.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEverything();
    const channel = supabase.channel('admin-finance').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
      db.getBookings().then(() => setRefresh(prev => prev + 1));
    }).subscribe();
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

    return { totalGross, totalAdminComm, breakdown };
  }, [refresh]);

  return (
    <div className="space-y-8 animate-slide-up pb-32 max-w-full overflow-x-hidden">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="premium-blur bg-zinc-900/40 rounded-[3rem] p-8 border border-white/10 flex flex-col items-center gap-6 relative overflow-hidden">
        <button onClick={fetchEverything} className="absolute top-6 right-6 p-3 bg-white/5 rounded-xl text-[#D4AF37]">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
        <div className="w-16 h-16 bg-[#D4AF37] rounded-[2rem] flex items-center justify-center text-black">
          <BarChart3 size={32} />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">NETWORK FINANCIJE</h2>
          <p className="text-zinc-500 text-[8px] font-black uppercase tracking-[0.4em] mt-2">ADMIN PANEL | ZAGREB</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-1">
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-6 bg-zinc-950 border-white/5">
             <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Ukupni Bruto</p>
             <p className="text-xl font-black text-white italic">{data.totalGross.toFixed(0)}€</p>
          </Card>
          <Card className="p-6 bg-emerald-500/10 border-emerald-500/20">
             <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest mb-1">Neto Admin</p>
             <p className="text-xl font-black text-emerald-400 italic">{data.totalAdminComm.toFixed(2)}€</p>
          </Card>
        </div>

        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-3 ml-4">
             <Wallet size={12} className="text-[#D4AF37]" />
             <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">MJESEČNI IZVJEŠTAJ PO BARBERU</h3>
          </div>
          
          {data.breakdown.length === 0 ? (
            <div className="py-20 text-center opacity-20 italic text-[10px] font-black uppercase tracking-widest">Nema zabilježenih šišanja</div>
          ) : data.breakdown.map(b => (
            <Card key={b.id} className="p-5 bg-zinc-950/80 border-white/5 rounded-[2rem] flex flex-col gap-4">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
                        <img src={b.pic} className="w-full h-full object-cover" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[11px] font-black text-white uppercase italic tracking-tighter">{b.name}</span>
                        <span className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest">{b.count} Šišanja</span>
                     </div>
                  </div>
                  <Badge variant="gold" className="text-[7px]">{((b.gross / (data.totalGross || 1)) * 100).toFixed(0)}% Udio</Badge>
               </div>

               <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.03]">
                  <div className="bg-black/40 rounded-xl p-3">
                     <p className="text-[6px] text-zinc-600 uppercase font-black mb-1">Isplata Barberu</p>
                     <p className="text-sm font-black text-white italic">{b.netBarber.toFixed(2)}€</p>
                  </div>
                  <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                     <p className="text-[6px] text-emerald-600 uppercase font-black mb-1">Provizija Trimly</p>
                     <p className="text-sm font-black text-emerald-500 italic">{b.adminFee.toFixed(2)}€</p>
                  </div>
               </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="px-1 pt-8 pb-12">
        <Button variant="danger" className="h-18 text-[11px] font-black" onClick={onLogout}>ODJAVA</Button>
      </div>
    </div>
  );
};

export default AdminDashboard;
