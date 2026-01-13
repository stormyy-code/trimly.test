
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../store/mockDatabase';
import { BarberProfile } from '../../types';
import { Card, Button, Badge } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Check, X, ShieldAlert, User as UserIcon, Loader2, RefreshCcw } from 'lucide-react';

interface AdminApprovalsProps {
  lang: Language;
}

const AdminApprovals: React.FC<AdminApprovalsProps> = ({ lang }) => {
  const [pending, setPending] = useState<BarberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const t = translations[lang];

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      // Direct call to Supabase through the db object
      const barbers = await db.getBarbers();
      const filtered = barbers.filter(b => b.approved === false);
      setPending(filtered);
    } catch (error) {
      console.error("Fetch pending error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleAction = async (barberId: string, approve: boolean) => {
    if (approve) {
      const success = await db.saveBarbers({ id: barberId, approved: true });
      if (success) {
        setPending(prev => prev.filter(b => b.id !== barberId));
      }
    } else {
      // In a real app, we might update a 'rejected' status or delete
      // For simplicity, we just refresh the list after a manual deletion if we had that logic
      fetchPending();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Provjera novih brijača...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-up pb-12">
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-8 border border-white/10 ios-shadow flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">{lang === 'hr' ? 'Hub za autorizaciju' : 'Authorization Hub'}</p>
          <h2 className="text-3xl font-black text-white">{lang === 'hr' ? 'Na čekanju' : 'Pending'}</h2>
        </div>
        <div className="w-14 h-14 bg-yellow-500 rounded-2xl flex items-center justify-center text-black shadow-2xl">
          <ShieldAlert size={28} />
        </div>
      </div>

      <div className="px-4">
        <button 
          onClick={fetchPending}
          className="flex items-center gap-2 px-6 py-3 bg-white/5 rounded-full border border-white/10 text-[9px] font-black text-[#D4AF37] uppercase tracking-widest active:scale-95 transition-all"
        >
          <RefreshCcw size={14} />
          {lang === 'hr' ? 'Osvježi listu' : 'Refresh List'}
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="py-32 text-center space-y-4 opacity-30">
          <div className="relative mx-auto w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-dashed border-white/10">
            <UserIcon size={32} />
          </div>
          <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-[10px]">
            {lang === 'hr' ? 'Nema novih brijača za odobrenje' : 'No new barbers for approval'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.map(barber => (
            <Card key={barber.id} className="p-8 space-y-8 border-white/[0.03] animate-lux-fade">
              <div className="flex gap-6">
                <img src={barber.profilePicture} className="w-20 h-20 rounded-[1.5rem] object-cover border border-white/5 shadow-2xl grayscale" alt="" />
                <div className="py-1">
                  <h3 className="font-black text-xl text-white tracking-tight italic uppercase">{barber.fullName}</h3>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1 opacity-60">{barber.neighborhood}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                  <Badge variant="gold">{barber.workMode}</Badge>
                  <span>Dodano: {new Date(barber.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-gray-400 font-medium leading-relaxed italic opacity-80 border-l-2 border-[#D4AF37]/40 pl-4">
                  "{barber.bio}"
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="secondary" className="flex-1 h-14" onClick={() => handleAction(barber.id, false)}>
                  <X size={16} strokeWidth={3} /> {t.decline}
                </Button>
                <Button variant="primary" className="flex-1 h-14" onClick={() => handleAction(barber.id, true)}>
                  <Check size={16} strokeWidth={3} /> {lang === 'hr' ? 'Odobri' : 'Approve'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminApprovals;
