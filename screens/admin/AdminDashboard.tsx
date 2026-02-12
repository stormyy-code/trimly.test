
import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../../store/database';
import { Card, Button, Toast, Badge } from '../../components/UI';
import { translations, Language } from '../../translations';
import { BarChart3, TrendingUp, Wallet, RefreshCw, Key, Plus, Copy, Check, Sparkles, Clock } from 'lucide-react';
import { APP_CONFIG, ADMIN_INVITE_CODE } from '../../constants';
import { supabase } from '../../store/supabase';

interface AdminDashboardProps {
  lang: Language;
  onLogout?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang, onLogout }) => {
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [globalBookings, setGlobalBookings] = useState<any[]>([]);
  const [globalBarbers, setGlobalBarbers] = useState<any[]>([]);
  const t = translations[lang];

  const fetchEverything = async () => {
    setLoading(true);
    try {
      // Dohvati SVE termine i SVE barbere direktno iz baze
      const [allB, allP, allU] = await Promise.all([
        db.getBookings(), 
        db.getBarbers(),
        db.getUsers()
      ]);
      
      setGlobalBookings(allB);
      setGlobalBarbers(allP);
      setRefresh(prev => prev + 1);
    } catch (err) {
      setToast({ msg: 'Greška pri sinkronizaciji.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEverything();
    const channel = supabase.channel('admin-finance-live').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
      fetchEverything();
    }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    let interval: any;
    if (timeLeft > 0 && generatedCode) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && generatedCode) {
      setGeneratedCode(null);
    }
    return () => clearInterval(interval);
  }, [timeLeft, generatedCode]);

  const data = useMemo(() => {
    const completedBookings = globalBookings.filter(b => b.status === 'completed');
    
    const totalGross = completedBookings.reduce((sum, b) => sum + (Number(b.price) || 0), 0);
    const totalAdminComm = totalGross * APP_CONFIG.ADMIN_COMMISSION;

    const breakdown = globalBarbers.filter(barber => barber.approved).map(barber => {
      const bBookings = completedBookings.filter(b => b.barberId === barber.id);
      const bGross = bBookings.reduce((sum, b) => sum + (Number(b.price) || 0), 0);
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
  }, [globalBookings, globalBarbers, refresh]);

  const handleGenerateCode = () => {
    const random = Math.floor(100000 + Math.random() * 900000);
    const code = `TR-${random}`;
    setGeneratedCode(code);
    setTimeLeft(90);
    setToast({ msg: 'Novi kôd pozivnice generiran!', type: 'success' });
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setToast({ msg: 'Kôd kopiran u clipboard!', type: 'success' });
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8 animate-slide-up pb-32 max-w-full overflow-x-hidden">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="premium-blur bg-zinc-900/40 rounded-[3rem] p-8 border border-white/10 flex flex-col items-center gap-6 relative overflow-hidden mx-1">
        <button onClick={fetchEverything} className="absolute top-6 right-6 p-3 bg-white/5 rounded-xl text-[#D4AF37]">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
        <div className="w-16 h-16 bg-[#D4AF37] rounded-[2rem] flex items-center justify-center text-black">
          <BarChart3 size={32} />
        </div>
        <div className="text-center w-full px-4 overflow-hidden">
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none truncate italic">NETWORK COMMAND</h2>
          <p className="text-zinc-500 text-[8px] font-black uppercase tracking-[0.4em] mt-2">ADMIN PANEL | ZAGREB</p>
        </div>
      </div>

      <section className="space-y-4 px-1">
        <div className="flex items-center gap-3 ml-4">
           <Key size={12} className="text-[#D4AF37]" />
           <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">UPRAVLJANJE POZIVNICAMA</h3>
        </div>
        <Card className="p-6 bg-zinc-950 border-white/5 space-y-4">
           {generatedCode ? (
             <div className="flex items-center justify-between p-5 bg-[#D4AF37]/10 rounded-2xl border border-[#D4AF37]/20 animate-lux-fade relative overflow-hidden">
                <div className="min-w-0 flex-1">
                   <p className="text-[7px] font-black text-[#D4AF37] uppercase tracking-widest mb-1 flex items-center gap-2">
                     <Clock size={8} /> Istječe za {timeLeft}s
                   </p>
                   <p className="text-xl font-black text-white italic tracking-tighter truncate">{generatedCode}</p>
                </div>
                <button onClick={() => handleCopyCode(generatedCode)} className="w-11 h-11 bg-[#D4AF37] text-black rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0 ml-4">
                  {copied === generatedCode ? <Check size={18} /> : <Copy size={18} />}
                </button>
                <div className="absolute bottom-0 left-0 h-1 bg-[#D4AF37] transition-all duration-1000 ease-linear" style={{ width: `${(timeLeft / 90) * 100}%` }}></div>
             </div>
           ) : (
             <div className="py-6 text-center border border-dashed border-white/10 rounded-2xl opacity-40">
                <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest italic leading-relaxed">Pritisnite tipku ispod za generiranje<br/>jednokratne pozivnice (90s)</p>
             </div>
           )}
           
           <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" className="h-14 text-[8px] uppercase font-black tracking-widest flex items-center justify-center gap-2 overflow-hidden" onClick={handleGenerateCode}>
                 <Plus size={14} className="shrink-0" /> <span className="truncate">GENERIRAJ KOD</span>
              </Button>
              <button 
                onClick={() => handleCopyCode(ADMIN_INVITE_CODE)}
                className="bg-black/40 border border-white/5 rounded-2xl flex items-center justify-center gap-2 text-[8px] font-black text-zinc-500 uppercase tracking-widest active:scale-95 transition-all overflow-hidden px-2"
              >
                <span className="truncate">Master Kôd</span> <Copy size={10} className="shrink-0" />
              </button>
           </div>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-4 px-1 overflow-hidden">
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-6 bg-zinc-950 border-white/5 overflow-hidden">
             <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1 truncate">Ukupni Bruto</p>
             <p className="text-xl font-black text-white italic truncate">{data.totalGross.toFixed(2)}€</p>
          </Card>
          <Card className="p-6 bg-emerald-500/10 border-emerald-500/20 overflow-hidden">
             <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest mb-1 truncate">Neto Admin (10%)</p>
             <p className="text-xl font-black text-emerald-400 italic truncate">{data.totalAdminComm.toFixed(2)}€</p>
          </Card>
        </div>

        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-3 ml-4">
             <TrendingUp size={12} className="text-[#D4AF37]" />
             <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">BALANSI BARBERA (SALDO)</h3>
          </div>
          
          {data.breakdown.length === 0 ? (
            <div className="py-20 text-center opacity-20 italic text-[10px] font-black uppercase tracking-widest truncate">Nema podataka o prometu</div>
          ) : data.breakdown.map(b => (
            <Card key={b.id} className="p-5 bg-zinc-950/80 border-white/5 rounded-[2rem] flex flex-col gap-4 overflow-hidden">
               <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                     <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0">
                        <img src={b.pic} className="w-full h-full object-cover" />
                     </div>
                     <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-black text-white uppercase italic tracking-tighter truncate">{b.name}</span>
                        <span className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest truncate">{b.count} Šišanja</span>
                     </div>
                  </div>
                  <div className="text-right shrink-0">
                     <p className="text-[6px] text-zinc-600 uppercase font-black mb-1">Saldo Barbera (90%)</p>
                     <p className="text-sm font-black text-[#D4AF37] italic truncate">{b.netBarber.toFixed(2)}€</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.03]">
                  <div className="bg-black/40 rounded-xl p-3 min-w-0 overflow-hidden text-center">
                     <p className="text-[6px] text-zinc-600 uppercase font-black mb-1 truncate italic">BRUTO PROMET</p>
                     <p className="text-xs font-black text-zinc-400 italic truncate">{b.gross.toFixed(2)}€</p>
                  </div>
                  <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10 min-w-0 overflow-hidden text-center">
                     <p className="text-[6px] text-emerald-600 uppercase font-black mb-1 truncate italic">PROVIZIJA (10%)</p>
                     <p className="text-xs font-black text-emerald-500 italic truncate">{b.adminFee.toFixed(2)}€</p>
                  </div>
               </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
