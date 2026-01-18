
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../store/database';
import { supabase } from '../../store/supabase';
import { BarberProfile } from '../../types';
import { Card, Button, Badge, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Check, X, ShieldAlert, Loader2, RefreshCcw, Mail, Search } from 'lucide-react';

interface AdminApprovalsProps {
  lang: Language;
}

const AdminApprovals: React.FC<AdminApprovalsProps> = ({ lang }) => {
  const [pending, setPending] = useState<BarberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const t = translations[lang];

  const fetchPending = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      // Prisilno povlačenje svježih podataka s servera, preskačući cache
      const { data, error } = await supabase
        .from('barbers')
        .select('*')
        .or('approved.eq.false,approved.is.null')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((b: any) => ({
        id: b.id,
        userId: b.user_id,
        fullName: b.full_name || '',
        profilePicture: b.profile_picture || 'https://i.ibb.co/C5fL3Pz/trimly-logo.png',
        neighborhood: b.neighborhood || '',
        bio: b.bio || '',
        workMode: b.work_mode || 'classic',
        approved: !!b.approved,
        featured: !!b.featured,
        createdAt: b.created_at,
        workingHours: b.working_hours || [],
        slotInterval: b.slot_interval || 45
      }));

      setPending(mapped);
    } catch (err: any) {
      console.error("Fetch pending error:", err);
      setToast({ msg: lang === 'hr' ? 'Greška pri sinkronizaciji s bazom.' : 'Database sync error.', type: 'error' });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchPending();

    const channel = supabase
      .channel('admin-approvals-live')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'barbers' 
      }, (payload) => {
        // Ako je netko odobren, makni ga odmah
        if (payload.eventType === 'UPDATE' && payload.new.approved === true) {
          setPending(prev => prev.filter(p => p.id !== payload.new.id));
        } else if (payload.eventType === 'INSERT') {
          fetchPending(false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPending]);

  const handleAction = async (barber: BarberProfile, approve: boolean) => {
    if (processingId) return;
    setProcessingId(barber.id);
    
    try {
      if (approve) {
        // 1. Odobri barbera
        const { error: barberError } = await supabase
          .from('barbers')
          .update({ approved: true })
          .eq('id', barber.id);

        if (barberError) throw barberError;

        // 2. Osiguraj ulogu 'barber' u profilu
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: 'barber' })
          .eq('id', barber.userId);

        if (profileError) console.warn("Role sync failed, but barber approved.");

        setToast({ 
          msg: lang === 'hr' ? `Barber ${barber.fullName} je ODOBREN!` : `Barber ${barber.fullName} APPROVED!`, 
          type: 'success' 
        });
        
        // Odmah makni iz lokalnog stanja
        setPending(prev => prev.filter(p => p.id !== barber.id));
      } else {
        // Odbijanje (brisanje zahtjeva)
        const { error: deleteError } = await supabase.from('barbers').delete().eq('id', barber.id);
        if (deleteError) throw deleteError;
        setPending(prev => prev.filter(p => p.id !== barber.id));
      }
    } catch (err: any) {
      console.error("Action error:", err);
      setToast({ msg: `Baza javlja: ${err.message}`, type: 'error' });
      // Ako ne uspije, osvježi listu da vratiš točno stanje
      fetchPending(false);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-slide-up pb-32">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="premium-blur bg-zinc-900/20 rounded-[3rem] p-10 border border-white/10 ios-shadow flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-amber-500 rounded-[2rem] flex items-center justify-center text-black shadow-2xl relative">
           <ShieldAlert size={32} />
           {pending.length > 0 && (
             <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-4 border-black flex items-center justify-center text-[10px] font-black text-white">
               {pending.length}
             </div>
           )}
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Autorizacija</h2>
          <p className="text-zinc-500 text-[8px] font-black uppercase tracking-[0.4em] mt-3">Verifikacija novih licenci</p>
        </div>
      </div>

      <div className="px-2">
        <button 
          onClick={() => fetchPending(true)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-zinc-950 rounded-2xl border border-white/5 text-[10px] font-black text-[#D4AF37] uppercase tracking-widest active:scale-95 transition-all shadow-xl"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Sinkronizacija...' : 'Osvježi listu zahtjeva'}
        </button>
      </div>

      {loading && pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 space-y-4 opacity-50">
          <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
          <span className="text-[9px] font-black uppercase tracking-widest">Pristupanje serveru...</span>
        </div>
      ) : pending.length === 0 ? (
        <div className="py-24 text-center space-y-6 opacity-40">
          <div className="mx-auto w-20 h-20 bg-zinc-900 rounded-[2rem] flex items-center justify-center border border-dashed border-white/20">
            <Search size={32} className="text-zinc-700" />
          </div>
          <p className="text-zinc-600 font-black uppercase tracking-[0.3em] text-[9px]">Svi zahtjevi su obrađeni</p>
        </div>
      ) : (
        <div className="space-y-6 px-1">
          {pending.map(barber => (
            <Card key={barber.id} className="p-8 space-y-8 border-white/[0.05] bg-zinc-950/40 relative overflow-hidden group">
              {processingId === barber.id && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="animate-spin text-[#D4AF37]" />
                  <span className="text-[8px] font-black text-white uppercase tracking-widest">Spremanje u bazu...</span>
                </div>
              )}
              
              <div className="flex gap-6 items-start">
                <div className="shrink-0 w-20 h-20 rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                   <img src={barber.profilePicture} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex-1 py-1 space-y-3 min-w-0">
                  <h3 className="font-black text-xl text-white tracking-tighter italic uppercase leading-none truncate">{barber.fullName}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="neutral">{barber.neighborhood}</Badge>
                    <Badge variant="gold" className="text-[7px]">{barber.workMode}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5 bg-black/40 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3 text-zinc-500 min-w-0">
                   <Mail size={14} className="text-[#D4AF37] shrink-0" />
                   <span className="text-[9px] font-bold lowercase tracking-normal break-all opacity-40">{barber.userId}</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-medium leading-relaxed italic border-l-2 border-[#D4AF37]/40 pl-4 break-words">
                  {barber.bio || 'Nema opisa profila.'}
                </p>
              </div>

              <div className="flex gap-4">
                <button 
                  className="flex-1 h-14 rounded-xl border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-500 active:bg-red-500/10 active:text-red-500 transition-colors" 
                  onClick={() => handleAction(barber, false)}
                >
                  <X size={16} className="inline mr-2" /> ODBIJ
                </button>
                <Button 
                  variant="primary" 
                  className="flex-[2] h-14 rounded-xl" 
                  onClick={() => handleAction(barber, true)}
                >
                  <Check size={16} className="inline mr-2" /> ODOBRI
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
