
import React, { useMemo, useEffect, useState } from 'react';
import { db } from '../../store/database';
import { Card } from '../../components/UI';
import { translations, Language } from '../../translations';
import { User } from '../../types';
import { Trophy, Crown, Star, Loader2, ChevronRight, Scissors, TrendingUp } from 'lucide-react';

interface LeaderboardScreenProps {
  lang: Language;
  onSelectBarber?: (id: string) => void;
}

type SortBy = 'rating' | 'cuts';

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ lang, onSelectBarber }) => {
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('rating');
  const [users, setUsers] = useState<User[]>(db.getUsersSync());
  const [tick, setTick] = useState(0);
  const t = translations[lang];

  const fetchData = async () => {
    setLoading(true);
    try {
      const uRes = await db.getUsers();
      setUsers(uRes);
      await Promise.all([
        db.getReviews(),
        db.getBookings(),
        db.getBarbers()
      ]);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const handleRegistryUpdate = (e: any) => {
      const { userId, banned } = e.detail || {};
      if (userId) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned } : u));
        setTick(t => t + 1);
      }
    };

    window.addEventListener('users-registry-updated', handleRegistryUpdate);
    return () => window.removeEventListener('users-registry-updated', handleRegistryUpdate);
  }, []);

  const reviews = db.getReviewsSync();
  const bookings = db.getBookingsSync().filter(b => b.status === 'completed');
  
  const rawBarbers = useMemo(() => {
    const all = db.getBarbersSync();
    return all.filter(b => {
      const u = users.find(user => user.id === b.userId);
      return b.approved === true && u && u.banned !== true;
    });
  }, [users, tick]);

  const data = useMemo(() => {
    return rawBarbers.map(barber => {
      const bBookings = bookings.filter(b => b.barberId === barber.id);
      const bReviews = reviews.filter(r => r.barberId === barber.id);
      
      const avgRating = bReviews.length 
        ? (bReviews.reduce((sum, r) => sum + r.rating, 0) / bReviews.length).toFixed(1) 
        : "0.0";
      
      return { 
        ...barber, 
        cutCount: bBookings.length,
        rating: avgRating,
        reviewCount: bReviews.length
      };
    }).sort((a, b) => {
      if (sortBy === 'rating') {
        if (parseFloat(b.rating) !== parseFloat(a.rating)) {
          return parseFloat(b.rating) - parseFloat(a.rating);
        }
        return b.cutCount - a.cutCount;
      } else {
        if (b.cutCount !== a.cutCount) {
          return b.cutCount - a.cutCount;
        }
        return parseFloat(b.rating) - parseFloat(a.rating);
      }
    });
  }, [rawBarbers, bookings, reviews, sortBy]);

  return (
    <div className="space-y-8 animate-slide-up pb-32 bg-black min-h-screen">
      <div className="premium-blur bg-[#D4AF37]/5 rounded-[3rem] p-8 border border-[#D4AF37]/20 flex flex-col items-center gap-5 mt-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <TrendingUp size={70} />
        </div>
        <div className="w-14 h-14 bg-[#D4AF37] rounded-[1.5rem] flex items-center justify-center text-black shadow-[0_15px_45px_rgba(212,175,55,0.4)]">
          <Trophy size={28} />
        </div>
        <div className="text-center">
          <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.4em] mb-1">Network Elite</p>
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">{t.ranks}</h2>
        </div>
      </div>

      <div className="flex bg-zinc-950 p-1.5 rounded-3xl border border-white/5 mx-2">
        <button 
          onClick={() => setSortBy('rating')} 
          className={`flex-1 py-4 text-[8px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${sortBy === 'rating' ? 'bg-[#D4AF37] text-black shadow-xl' : 'text-zinc-600'}`}
        >
          <Star size={12} className={sortBy === 'rating' ? 'fill-black' : ''} /> Najbolje ocijenjeni
        </button>
        <button 
          onClick={() => setSortBy('cuts')} 
          className={`flex-1 py-4 text-[8px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${sortBy === 'cuts' ? 'bg-[#D4AF37] text-black shadow-xl' : 'text-zinc-600'}`}
        >
          <Scissors size={12} /> Najviše šišanja
        </button>
      </div>

      <section className="space-y-3 px-2">
        {loading && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
             <span className="text-[9px] font-black text-zinc-800 uppercase tracking-widest">Sinkronizacija ljestvice...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="py-20 text-center opacity-20 text-[9px] font-black uppercase tracking-widest italic">Trenutno nema rangiranih barbera</div>
        ) : data.map((barber, index) => {
          const isWinner = index === 0;
          const hasReviews = barber.reviewCount > 0;

          return (
            <Card 
              key={barber.id} 
              onClick={() => onSelectBarber?.(barber.id)}
              className={`p-4 flex items-center gap-4 transition-all relative overflow-hidden rounded-[2rem] border ${
                isWinner ? 'border-[#D4AF37] bg-black shadow-[0_10px_40px_rgba(212,175,55,0.1)]' : 'border-white/5 bg-zinc-950/30'
              }`}
            >
              <div className="flex items-center justify-center w-6 text-2xl font-black italic shrink-0">
                <span className={`${index === 0 ? 'text-[#D4AF37]' : index === 1 ? 'text-zinc-400' : index === 2 ? 'text-amber-800' : 'text-zinc-800'}`}>
                  {index + 1}
                </span>
              </div>

              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden border border-white/10 shadow-xl">
                   <img src={barber.profilePicture} className="w-full h-full object-cover brightness-90" alt="" />
                </div>
                {isWinner && (
                  <div className="absolute -top-1.5 -right-1.5 bg-[#D4AF37] p-1 rounded-lg border-2 border-black shadow-2xl z-10">
                    <Crown size={10} className="text-black" />
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col justify-center min-w-0">
                <h3 className="font-black text-lg text-white uppercase italic truncate tracking-tighter leading-tight mb-2">
                  {barber.fullName}
                </h3>
                
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border w-fit ${sortBy === 'rating' ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30' : 'bg-white/5 border-white/10'}`}>
                    <Star size={10} className={`${hasReviews ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-zinc-700'}`} />
                    <span className={`text-[10px] font-black ${hasReviews ? 'text-white' : 'text-zinc-700'}`}>
                      {hasReviews ? barber.rating : 'Novo'}
                    </span>
                  </div>

                  <div className={`flex gap-1.5 items-center px-2 py-0.5 rounded-lg border ${sortBy === 'cuts' ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30' : 'bg-white/5 border-white/10'}`}>
                    <span className={`text-[9px] font-black ${sortBy === 'cuts' ? 'text-white' : 'text-zinc-500'}`}>{barber.cutCount}</span>
                    <span className="text-zinc-600 text-[6.5px] font-black uppercase tracking-widest">Šišanja</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="text-zinc-800" />
            </Card>
          );
        })}
      </section>
    </div>
  );
};

export default LeaderboardScreen;
