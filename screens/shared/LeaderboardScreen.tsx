
import React, { useMemo, useEffect, useState } from 'react';
import { db } from '../../store/database';
import { Card } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Trophy, Crown, Star, Loader2 } from 'lucide-react';

interface LeaderboardScreenProps {
  lang: Language;
}

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ lang }) => {
  const [loading, setLoading] = useState(true);
  const t = translations[lang];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([
        db.getReviews(),
        db.getBookings(),
        db.getBarbers()
      ]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const reviews = db.getReviewsSync();
  const bookings = db.getBookingsSync().filter(b => b.status === 'completed');
  const rawBarbers = db.getBarbersSync().filter(b => b.approved);

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
      if (parseFloat(b.rating) !== parseFloat(a.rating)) {
        return parseFloat(b.rating) - parseFloat(a.rating);
      }
      return b.cutCount - a.cutCount;
    });
  }, [rawBarbers, bookings, reviews]);

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic">Ažuriranje ljestvice...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-up pb-32 bg-black min-h-screen">
      <div className="premium-blur bg-[#D4AF37]/5 rounded-[3rem] p-10 border border-[#D4AF37]/20 flex flex-col items-center gap-6 mt-4">
        <div className="w-16 h-16 bg-[#D4AF37] rounded-[1.75rem] flex items-center justify-center text-black shadow-[0_15px_45px_rgba(212,175,55,0.4)]">
          <Trophy size={32} />
        </div>
        <div className="text-center">
          <p className="text-[11px] font-black text-[#D4AF37] uppercase tracking-[0.4em] mb-2">Network Elite</p>
          <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">{t.ranks}</h2>
          <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.2em] mt-3">Samo stvarni rezultati barbera</p>
        </div>
      </div>

      <section className="space-y-4 px-2">
        {data.map((barber, index) => {
          const isWinner = index === 0;
          const hasReviews = barber.reviewCount > 0;

          return (
            <Card 
              key={barber.id} 
              className={`p-6 flex items-center gap-6 transition-all relative overflow-hidden rounded-[2.5rem] border ${
                isWinner ? 'border-[#D4AF37] bg-black shadow-[0_10px_40px_rgba(212,175,55,0.1)]' : 'border-white/5 bg-zinc-950/30'
              }`}
            >
              <div className="flex items-center justify-center w-10 text-3xl font-black italic shrink-0">
                <span className={`${index === 0 ? 'text-[#D4AF37]' : index === 1 ? 'text-zinc-400' : index === 2 ? 'text-amber-800' : 'text-zinc-800'}`}>
                  {index + 1}
                </span>
              </div>

              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-[2rem] overflow-hidden border-2 border-white/10 shadow-2xl">
                   <img src={barber.profilePicture} className="w-full h-full object-cover grayscale brightness-90" alt="" />
                </div>
                {isWinner && (
                  <div className="absolute -top-2 -right-2 bg-[#D4AF37] p-1.5 rounded-lg border-2 border-black shadow-2xl z-10">
                    <Crown size={12} className="text-black" />
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col justify-center min-w-0">
                <h3 className="font-black text-xl text-white uppercase italic truncate tracking-tighter leading-tight mb-2">
                  {barber.fullName}
                </h3>
                
                <div className="flex items-center gap-4">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border w-fit ${hasReviews ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30' : 'bg-white/5 border-white/10'}`}>
                    <Star size={12} className={`${hasReviews ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-zinc-700'}`} />
                    <span className={`text-xs font-black ${hasReviews ? 'text-white' : 'text-zinc-700'}`}>
                      {hasReviews ? barber.rating : 'Novo'}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-white text-[10px] font-black leading-none">{barber.reviewCount}</span>
                    <span className="text-zinc-600 text-[7px] font-black uppercase tracking-widest">Recenzija</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
};

export default LeaderboardScreen;
