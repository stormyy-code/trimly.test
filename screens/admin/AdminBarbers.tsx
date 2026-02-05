
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../store/database';
import { Card, Button, Badge, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Star, Trash2, MapPin, Scissors, Trophy, ShieldAlert, AlertTriangle, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';
import { User, BarberProfile } from '../../types';
import Logo from '../../components/Logo';

interface AdminBarbersProps {
  lang: Language;
  onSelectBarber: (id: string) => void;
}

const AdminBarbers: React.FC<AdminBarbersProps> = ({ lang, onSelectBarber }) => {
  const [confirmDelete, setConfirmDelete] = useState<{ bId: string, uId: string, name: string } | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allBarbers, setAllBarbers] = useState<BarberProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const t = translations[lang];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [users, barbers] = await Promise.all([
        db.getUsers(),
        db.getBarbers()
      ]);
      setAllUsers(users);
      setAllBarbers(barbers);
    } catch (err) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const handleRegistryUpdate = () => {
      fetchData();
    };

    window.addEventListener('users-registry-updated', handleRegistryUpdate);
    window.addEventListener('app-sync-complete', handleRegistryUpdate);
    
    return () => {
      window.removeEventListener('users-registry-updated', handleRegistryUpdate);
      window.removeEventListener('app-sync-complete', handleRegistryUpdate);
    };
  }, []);

  const activeBarbers = useMemo(() => {
    return allBarbers.filter(barber => {
      const u = allUsers.find(u => u.id === barber.userId);
      return u && u.banned !== true && barber.approved === true;
    });
  }, [allUsers, allBarbers]);

  const bannedBarbers = useMemo(() => {
    return allUsers
      .filter(u => u.banned === true && (u.role === 'barber' || allBarbers.some(b => b.userId === u.id)))
      .map(u => {
        const profile = allBarbers.find(b => b.userId === u.id);
        return { user: u, profile };
      });
  }, [allUsers, allBarbers]);

  const toggleFeatured = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const barber = allBarbers.find(b => b.id === id);
    if (barber) {
      const success = await db.saveBarbers({ ...barber, featured: !barber.featured });
      if (success) {
        setToast({ msg: t.done, type: 'success' });
        fetchData();
      }
    }
  };

  const handleDeleteClick = (barber: BarberProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete({ bId: barber.id, uId: barber.userId, name: barber.fullName });
  };

  const handleFinalRemoval = async () => {
    if (!confirmDelete) return;
    setActionLoading(true);
    const result = await db.setUserBanStatus(confirmDelete.uId, true);
    if (result.success) {
      setToast({ msg: 'Licenca uspješno oduzeta.', type: 'success' });
      setConfirmDelete(null);
      fetchData();
    } else {
      setToast({ msg: result.error || 'Greška', type: 'error' });
    }
    setActionLoading(false);
  };

  const handleUnban = async (userId: string) => {
    setActionLoading(true);
    const result = await db.setUserBanStatus(userId, false);
    if (result.success) {
      setToast({ msg: 'Licenca vraćena.', type: 'success' });
      fetchData();
    }
    setActionLoading(false);
  };

  const SafeImage = ({ src, className }: { src: string, className: string }) => {
    const [error, setError] = useState(false);
    const fallback = "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=200";
    return <img src={error || !src ? fallback : src} onError={() => setError(true)} className={className} />;
  };

  return (
    <div className="space-y-10 animate-slide-up pb-24 relative">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-8 border border-white/10 ios-shadow flex flex-col items-center gap-4">
        <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white border border-white/10 overflow-hidden p-2 shrink-0">
           <Logo className="w-full h-full" />
        </div>
        <div className="text-center w-full min-w-0">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1 truncate">{t.registryControl}</p>
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter truncate">ČLANOVI MREŽE</h2>
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] flex items-center gap-3 truncate">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0" /> AKTIVNI BARBERI
          </h3>
          <button onClick={fetchData} className="text-zinc-500 shrink-0">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="space-y-4 px-1">
          {loading && activeBarbers.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Osvježavanje liste...</span>
            </div>
          ) : activeBarbers.length === 0 ? (
            <div className="py-20 text-center opacity-30 w-full text-[10px] font-black uppercase tracking-widest italic">Nema aktivnih barbera</div>
          ) : activeBarbers.map(barber => (
            <Card key={barber.id} onClick={() => onSelectBarber(barber.id)} className={`p-5 flex items-center gap-5 transition-all rounded-[2.25rem] border min-w-0 ${barber.featured ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/5 bg-zinc-950'}`}>
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-[1.25rem] overflow-hidden border border-white/10">
                  <SafeImage src={barber.profilePicture} className="w-full h-full object-cover" />
                </div>
                {barber.weeklyWinner && <div className="absolute -top-1.5 -right-1.5 bg-[#D4AF37] p-1.5 rounded-lg border-2 border-black z-10"><Trophy size={10} className="text-black" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-base text-white tracking-tight uppercase italic truncate leading-none">{barber.fullName}</h3>
                <div className="flex items-center gap-2 text-[8px] text-zinc-600 font-black uppercase tracking-widest mt-2 truncate">
                  <MapPin size={10} className="text-[#D4AF37] shrink-0" /> {barber.neighborhood}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={(e) => toggleFeatured(barber.id, e)} className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${barber.featured ? 'bg-[#D4AF37] border-[#D4AF37] text-black' : 'bg-white/5 border-white/5 text-zinc-600'}`}>
                  <Star size={18} fill={barber.featured ? 'currentColor' : 'none'} />
                </button>
                <button onClick={(e) => handleDeleteClick(barber, e)} className="w-11 h-11 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 flex items-center justify-center active:scale-90">
                  <Trash2 size={18} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6 pb-12">
        <h3 className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.4em] flex items-center gap-3 px-1 truncate">
          <ShieldAlert size={16} className="shrink-0" /> ODUZETE LICENCE
        </h3>
        <div className="space-y-4 px-1">
          {bannedBarbers.map(({ user, profile }) => (
            <Card key={user.id} className="p-5 flex items-center gap-5 rounded-[2.25rem] border-red-500/10 bg-red-950/5 opacity-80 grayscale min-w-0">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-red-500/10 shrink-0">
                <SafeImage src={profile?.profilePicture || ''} className="w-full h-full object-cover opacity-40" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-xs text-zinc-400 uppercase italic line-through truncate">{profile?.fullName || user.email}</h3>
                <Badge variant="error" className="mt-1 truncate">Suspended</Badge>
              </div>
              <button onClick={() => handleUnban(user.id)} className="w-11 h-11 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 flex items-center justify-center shrink-0">
                <RefreshCw size={18} className={actionLoading ? 'animate-spin' : ''} />
              </button>
            </Card>
          ))}
        </div>
      </section>

      {confirmDelete && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center px-6 animate-lux-fade">
          <div className="absolute inset-0 bg-black/95 premium-blur" onClick={() => !actionLoading && setConfirmDelete(null)}></div>
          <Card className="relative w-full max-w-sm bg-zinc-950 border border-red-500/30 rounded-[3rem] p-10 space-y-8 flex flex-col items-center text-center shadow-2xl">
            <AlertTriangle size={36} className="text-red-500" />
            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Suspendirati?</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-loose">Oduzimanje licence za {confirmDelete.name}.</p>
            <div className="flex flex-col w-full gap-3">
              <Button variant="danger" className="h-16 w-full" onClick={handleFinalRemoval} loading={actionLoading}>Da, Oduzmi Licencu</Button>
              <button className="h-16 w-full text-zinc-500 text-[10px] font-black uppercase tracking-widest" onClick={() => !actionLoading && setConfirmDelete(null)}>Odustani</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminBarbers;
