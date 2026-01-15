
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<{ bId: string, uId: string, name: string } | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const t = translations[lang];

  const fetchData = async () => {
    setLoading(true);
    const users = await db.getUsers();
    setAllUsers(users);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const rawBarbers = useMemo(() => {
    return db.getBarbersSync();
  }, [refreshTrigger]);

  const toggleFeatured = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const all = db.getBarbersSync();
    const targetBarber = all.find(b => b.id === id);
    if (targetBarber) {
      const success = await db.saveBarbers({ ...targetBarber, featured: !targetBarber.featured });
      if (success) {
        setRefreshTrigger(prev => prev + 1);
        setToast({ msg: t.done, type: 'success' });
      }
    }
  };

  const handleDeleteClick = (barber: BarberProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete({ bId: barber.id, uId: barber.userId, name: barber.fullName });
  };

  const handleFinalRemoval = async () => {
    if (!confirmDelete) return;
    const success = await db.setUserBanStatus(confirmDelete.uId, true);
    if (success) {
      setToast({ msg: 'Licenca oduzeta.', type: 'success' });
      setConfirmDelete(null);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleUnban = async (userId: string) => {
    const success = await db.setUserBanStatus(userId, false);
    if (success) {
      setToast({ msg: 'Licenca vraćena.', type: 'success' });
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const activeBarbers = useMemo(() => {
    return rawBarbers.filter(barber => {
      const u = allUsers.find(u => u.id === barber.userId);
      return u && !u.banned && barber.approved;
    });
  }, [rawBarbers, allUsers]);

  const bannedBarbers = useMemo(() => {
    return allUsers
      .filter(u => u.role === 'barber' && u.banned)
      .map(u => {
        const profile = db.getBarbersSync().find(b => b.userId === u.id);
        return { user: u, profile };
      });
  }, [allUsers]);

  const SafeImage = ({ src, alt, className }: { src: string, alt: string, className: string }) => {
    const [error, setError] = useState(false);
    const fallback = "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=200&h=200";
    return (
      <img src={error ? fallback : src} alt={alt} onError={() => setError(true)} className={className} />
    );
  };

  return (
    <div className="space-y-10 animate-slide-up pb-24">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-8 border border-white/10 ios-shadow flex flex-col items-center gap-4">
        <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white border border-white/10 overflow-hidden p-2">
           <Logo className="w-full h-full" />
        </div>
        <div className="text-center w-full">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1 w-full text-center">{t.registryControl}</p>
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter w-full text-center">{t.professionals}</h2>
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] flex items-center gap-3">
            <ShieldCheck size={16} className="text-emerald-500" /> {t.activeRegistry}
          </h3>
          <button onClick={fetchData} className="text-zinc-500 hover:text-white transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="space-y-4 px-1">
          {loading && activeBarbers.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-zinc-800" /></div>
          ) : activeBarbers.length === 0 ? (
            <div className="py-20 text-center opacity-30 w-full">
              <Scissors className="mx-auto" size={32} />
              <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-[10px] w-full text-center">{t.noActiveBarbers}</p>
            </div>
          ) : (
            activeBarbers.map(barber => (
              <Card key={barber.id} onClick={() => onSelectBarber(barber.id)} className={`p-5 flex items-center gap-5 transition-all rounded-[2.25rem] group border ${barber.featured ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/[0.05] bg-zinc-950'}`}>
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-[1.25rem] overflow-hidden border border-white/10 shadow-2xl grayscale group-hover:grayscale-0 transition-all">
                    <SafeImage src={barber.profilePicture} className="w-full h-full object-cover" alt={barber.fullName} />
                  </div>
                  {barber.weeklyWinner && (
                    <div className="absolute -top-1.5 -right-1.5 bg-[#D4AF37] p-1.5 rounded-lg border-2 border-black shadow-lg z-10">
                      <Trophy size={10} className="text-black" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className="font-black text-base text-white tracking-tight truncate uppercase italic leading-none">{barber.fullName}</h3>
                  <div className="flex items-center gap-2 text-[8px] text-zinc-500 font-black uppercase tracking-[0.15em] mt-2">
                    <MapPin size={10} className="text-[#D4AF37]" strokeWidth={3} />
                    <span className="truncate">{barber.neighborhood}</span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 items-center">
                  <button onClick={(e) => toggleFeatured(barber.id, e)} className={`w-11 h-11 rounded-2xl transition-all flex items-center justify-center border ${barber.featured ? 'bg-[#D4AF37] border-[#D4AF37] text-black' : 'bg-white/5 border-white/5 text-zinc-600'}`}>
                    <Star size={18} fill={barber.featured ? 'currentColor' : 'none'} />
                  </button>
                  <button onClick={(e) => handleDeleteClick(barber, e)} className="w-11 h-11 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 flex items-center justify-center active:scale-90">
                    <Trash2 size={18} />
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.4em] flex items-center gap-3 px-1">
          <ShieldAlert size={16} /> {t.revokedLicenses}
        </h3>
        <div className="space-y-4 px-1">
          {bannedBarbers.length > 0 ? bannedBarbers.map(({ user, profile }) => (
            <Card key={user.id} className="p-5 flex items-center gap-5 rounded-[2.25rem] border-red-500/10 bg-red-950/5 opacity-80 grayscale">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-red-500/10 opacity-40">
                <SafeImage src={profile?.profilePicture || ''} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-xs text-zinc-400 uppercase italic line-through">{profile?.fullName || user.email}</h3>
                <Badge variant="error">Banned</Badge>
              </div>
              <button onClick={() => handleUnban(user.id)} className="w-11 h-11 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 flex items-center justify-center">
                <RefreshCw size={18} />
              </button>
            </Card>
          )) : (
            <div className="py-10 text-center opacity-10 text-[9px] font-black uppercase tracking-widest">{t.noRevokedProfiles}</div>
          )}
        </div>
      </section>

      {confirmDelete && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center px-6 animate-lux-fade">
          <div className="absolute inset-0 bg-black/95 premium-blur" onClick={() => setConfirmDelete(null)}></div>
          <Card className="relative w-full max-w-sm bg-zinc-950 border border-red-500/30 rounded-[3rem] p-10 space-y-8 flex flex-col items-center text-center">
            <AlertTriangle size={36} className="text-red-500" />
            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Suspend Account?</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-loose">
              Suspending <span className="text-red-400">{confirmDelete.name}</span> will block their login and hide their profile.
            </p>
            <div className="flex flex-col w-full gap-3">
              <Button variant="danger" className="h-16 w-full" onClick={handleFinalRemoval}>Yes, Suspend</Button>
              <Button variant="secondary" className="h-16 w-full bg-transparent border-white/5" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminBarbers;
