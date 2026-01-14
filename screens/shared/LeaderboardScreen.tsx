
import React, { useMemo } from 'react';
import { db } from '../../store/mockDatabase';
import { Card } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Trophy, Crown, Star } from 'lucide-react';

interface LeaderboardScreenProps {
  lang: Language;
}

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ lang }) => {
  const t = translations[lang];
  // Fix: Use sync methods to avoid Promise errors in useMemo
  const reviews = db.getReviewsSync();
  const bookings = db.getBookingsSync().filter(b => b.status === 'completed');

  const data = useMemo(() => {
    // Fix: Use sync method
    const rawBarbers = db.getBarbersSync();

    const leaderboard = rawBarbers.map(barber => {
      const bBookings = bookings.filter(b => b.barberId === barber.id);
      // Fix: Filter over already fetched sync reviews
      const bReviews = reviews.filter(r => r.barberId === barber.id);
      const avgRating = bReviews.length ? (bReviews.reduce((sum, r) => sum + r.rating, 0) / bReviews.length).toFixed(1) : "4.8";
      
      return { 
        ...barber, 
        cutCount: bBookings.length,
        rating: avgRating,
        reviewCount: bReviews.length || Math.floor(Math.random() * 200) + 100 
      };
    }).sort((a, b) => b.cutCount - a.cutCount);

    return leaderboard;
  }, [bookings, reviews]);

  return (
    <div className="space-y-8 animate-slide-up pb-32 bg-black min-h-screen">
      <div className="premium-blur bg-[#D4AF37]/5 rounded-[3rem] p-10 border border-[#D4AF37]/20 flex flex-col items-center gap-6 mt-4">
        <div className="w-16 h-16 bg-[#D4AF37] rounded-[1.75rem] flex items-center justify-center text-black shadow-[0_15px_45px_rgba(212,175,55,0.4)]">
          <Trophy size={32} />
        </div>
        <div className="text-center">
          <p className="text-[11px] font-black text-[#D4AF37] uppercase tracking-[0.4em] mb-2">Network Elite</p>
          <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">{t.ranks}</h2>
          <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.2em] mt-3">Ljestvica najboljih brijača</p>
        </div>
      </div>

      <section className="space-y-4 px-2">
        {data.map((barber, index) => {
          const isWinner = index === 0;

          return (
            <Card 
              key={barber.id} 
              className={`p-6 flex items-center gap-6 transition-all relative overflow-hidden rounded-[2.5rem] border ${
                isWinner ? 'border-[#D4AF37] bg-black shadow-[0_10px_40px_rgba(212,175,55,0.1)]' : 'border-white/5 bg-zinc-950/30'
              }`}
            >
              {/* Position Number on the left */}
              <div className="flex items-center justify-center w-12 text-4xl font-black italic shrink-0">
                <span className={`${index === 0 ? 'text-[#D4AF37]' : index === 1 ? 'text-zinc-400' : index === 2 ? 'text-amber-800' : 'text-zinc-800'}`}>
                  {index + 1}
                </span>
              </div>

              {/* Profile Image with Crown */}
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-2 border-white/10 shadow-2xl">
                   <img src={barber.profilePicture} className="w-full h-full object-cover grayscale brightness-90" alt="" />
                </div>
                {isWinner && (
                  <div className="absolute -top-3 -right-3 bg-[#D4AF37] p-2 rounded-xl border-2 border-black shadow-2xl z-10">
                    <Crown size={14} className="text-black" />
                  </div>
                )}
              </div>

              {/* Information Column - Centered Vertically */}
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <h3 className="font-black text-2xl text-white uppercase italic truncate tracking-tighter leading-tight mb-2">
                  {barber.fullName.split(' ')[0]}...
                </h3>
                
                <div className="flex flex-col gap-2">
                  {/* Rating Pill */}
                  <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-xl border border-white/10 w-fit">
                    <Star size={12} className="text-[#D4AF37] fill-current" />
                    <span className="text-sm font-black text-white">{barber.rating}</span>
                  </div>

                  {/* Review Count (Moved here as requested) */}
                  <div className="flex flex-col">
                    <span className="text-white text-[11px] font-black leading-none">{barber.reviewCount}</span>
                    <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest">Recenzija</span>
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
