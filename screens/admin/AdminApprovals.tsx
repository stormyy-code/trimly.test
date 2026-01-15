
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../store/database';
import { BarberProfile } from '../../types';
import { Card, Button, Badge, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Check, X, ShieldAlert, User as UserIcon, Loader2, RefreshCcw, Mail, AlertTriangle } from 'lucide-react';

interface AdminApprovalsProps {
  lang: Language;
}

const AdminApprovals: React.FC<AdminApprovalsProps> = ({ lang }) => {
  const [pending, setPending] = useState<BarberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = translations[lang];

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const barbers = await db.getBarbers();
      const filtered = barbers.filter(b => b.approved === false || b.approved === null);
      setPending(filtered);
    } catch (err) {
      console.error("Fetch pending error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleAction = async (barber: BarberProfile, approve: boolean) => {
    setProcessingId(barber.id);
    setError(null);
    try {
      if (approve) {
        const barberSuccess = await db.approveBarber(barber.id);
        if (!barberSuccess) throw new Error("Neuspješno odobravanje barbera.");
        
        const profileSuccess = await db.updateProfileRole(barber.userId, 'barber');
        if (!profileSuccess) throw new Error("Neuspješna promjena uloge.");

        setPending(prev => prev.filter(p => p.id !== barber.id));
      } else {
        setPending(prev => prev.filter(p => p.id !== barber.id));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-6">
        <Loader2 className="animate-spin text-[#D4AF37]" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 animate-pulse text-center">
          Pristupanje bazi...<br/>Zagreb Network Auth
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-up pb-32">
      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
      
      <div className="premium-blur bg-zinc-900/20 rounded-[3rem] p-10 border border-white/10 ios-shadow flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-amber-500 rounded-[2rem] flex items-center justify-center text-black shadow-2xl relative">
           <ShieldAlert size={32} />
           <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-4 border-black flex items-center justify-center text-[10px] font-black text-white">
             {pending.length}
           </div>
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Autorizacija</h2>
          <p className="text-zinc-500 text-[8px] font-black uppercase tracking-[0.4em] mt-3">Verified Partners Hub</p>
        </div>
      </div>

      <div className="px-2">
        <button 
          onClick={fetchPending}
          className="flex items-center gap-3 px-6 py-4 bg-zinc-950 rounded-2xl border border-white/5 text-[9px] font-black text-zinc-500 uppercase tracking-widest active:scale-95 transition-all shadow-xl"
        >
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          Osvježi Zahtjeve
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="py-32 text-center space-y-6 opacity-40">
          <div className="mx-auto w-24 h-24 bg-zinc-900 rounded-[2.5rem] flex items-center justify-center border border-dashed border-white/20">
            <UserIcon size={40} className="text-zinc-700" />
          </div>
          <p className="text-zinc-600 font-black uppercase tracking-[0.4em] text-[9px]">Svi zahtjevi su obrađeni</p>
        </div>
      ) : (
        <div className="space-y-6 px-1">
          {pending.map(barber => (
            <Card key={barber.id} className="p-8 space-y-8 border-white/[0.05] bg-zinc-950/40 relative overflow-hidden group">
              {processingId === barber.id && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                  <Loader2 className="animate-spin text-[#D4AF37]" />
                </div>
              )}
              
              <div className="flex gap-8">
                <div className="w-24 h-24 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl transition-all duration-700">
                   <img src={barber.profilePicture} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex-1 py-1 space-y-4">
                  <h3 className="font-black text-2xl text-white tracking-tighter italic uppercase leading-none">{barber.fullName}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="neutral" className="bg-white/5">{barber.neighborhood}</Badge>
                    <Badge variant="gold" className="text-[7px]">{barber.workMode}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-6 bg-black/40 rounded-3xl border border-white/5">
                <div className="flex items-center gap-3 text-zinc-500">
                   <Mail size={14} className="text-[#D4AF37]" />
                   <span className="text-[10px] font-bold lowercase tracking-normal">{barber.userId}</span>
                </div>
                <p className="text-xs text-zinc-400 font-medium leading-relaxed italic border-l-2 border-[#D4AF37]/40 pl-4">
                  "{barber.bio || 'Barber nije dostavio biografiju.'}"
                </p>
              </div>

              <div className="flex gap-4">
                <button 
                  className="flex-1 h-16 rounded-2xl border border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500" 
                  onClick={() => handleAction(barber, false)}
                >
                  <X size={18} className="inline mr-2" /> ODBIJ
                </button>
                <Button 
                  variant="primary" 
                  className="flex-[2] h-16 rounded-2xl shadow-[0_15px_40px_rgba(212,175,55,0.1)]" 
                  onClick={() => handleAction(barber, true)}
                >
                  <Check size={18} className="inline mr-2" /> ODOBRI PRISTUP
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminApprovals;
