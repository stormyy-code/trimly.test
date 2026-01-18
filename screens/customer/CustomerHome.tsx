
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../store/database';
import { BarberProfile, User } from '../../types';
import { Card, Badge } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Search, Trophy, Sparkles, Crown, MessageSquare, ArrowDownNarrowWide, SlidersHorizontal, Scissors, Star } from 'lucide-react';

interface CustomerHomeProps {
  onSelectBarber: (id: string) => void;
  lang: Language;
}

type SortType = 'recommended' | 'price-low' | 'top-rated';

const CustomerHome: React.FC<CustomerHomeProps> = ({ onSelectBarber, lang }) => {
  const [selectedQuarter, setSelectedQuarter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState<SortType>('recommended');
  const [users, setUsers] = useState<User[]>([]);
  const [refresh, setRefresh] = useState(0);

  const t = translations[lang];
  
  useEffect(() => {
    const sync = async () => {
      const [uRes] = await Promise.allSettled([
        db.getUsers(),
        db.getBarbers(), 
        db.getReviews(), 
        db.getServices()
      ]);
      if (uRes.status === 'fulfilled') {
        setUsers(uRes.value as User[]);
      }
      setRefresh(prev => prev + 1);
    };
    sync();
  }, []);

  const barbers = useMemo(() => {
    const raw = db.getBarbersSync();
    return raw.filter(b => {
      const u = users.find(user => user.id === b.userId);
      return b.approved && u && u.banned !== true;
    });
  }, [users, refresh]);

  const allReviews = db.getReviewsSync();
  const allServices = db.getServicesSync();
  
  const featuredBarbers = useMemo(() => barbers.filter(b => b.featured), [barbers]);

  const filteredBarbers = useMemo(() => {
    let result = barbers.filter(b => {
      const matchQuarter = selectedQuarter === 'All' || b.neighborhood === selectedQuarter;
      const matchSearch = b.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        b.bio.toLowerCase().includes(searchQuery.toLowerCase());
      return matchQuarter && matchSearch;
    }).map(barber => {
      const bReviews = allReviews.filter(r => r.barberId === barber.id);
      const bServices = allServices.filter(s => s.barberId === barber.id);
      
      const avgRating = bReviews.length 
        ? (bReviews.reduce((sum, r) => sum + r.rating, 0) / bReviews.length).toFixed(1)
        : "0.0";

      const minPrice = bServices.length
        ? Math.min(...bServices.map(s => s.price))
        : 0;

      return { 
        ...barber, 
        reviewCount: bReviews.length,
        avgRating,
        minPrice
      };
    });

    switch (sortType) {
      case 'price-low':
        result.sort((a, b) => (a.minPrice || 999) - (b.minPrice || 999));
        break;
      case 'top-rated':
        result.sort((a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating));
        break;
      case 'recommended':
      default:
        result.sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return b.reviewCount - a.reviewCount;
        });
        break;
    }

    return result;
  }, [barbers, allReviews, allServices, selectedQuarter, searchQuery, sortType]);

  const SafeImage = ({ src, className }: { src: string, className: string }) => {
    const [error, setError] = useState(false);
    return (
      <img src={error || !src ? "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=200" : src} 
           onError={() => setError(true)} className={`${className} object-cover w-full h-full`} alt="" />
    );
  };

  return (
    <div className="space-y-10 animate-lux-fade overflow-x-hidden pb-12">
      <section className="space-y-6">
        <div className="flex justify-between items-end px-1">
          <div className="space-y-1">
            <p className="text-[#C5A059] text-[8px] font-black uppercase tracking-[0.4em]">City Network</p>
            <h2 className="text-3xl font-black text-white flex items-center gap-2 tracking-tighter italic uppercase leading-none">
              {t.explore} Professionals
            </h2>
          </div>
        </div>

        <div className="space-y-4 px-1">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-700" size={16} />
            <input
              type="text"
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0F0F0F] rounded-2xl pl-14 pr-6 py-5 border border-white/5 focus:border-[#C5A059] outline-none transition-all text-white text-xs font-bold shadow-2xl"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
             <button onClick={() => setSortType('recommended')} className={`shrink-0 px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${sortType === 'recommended' ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-zinc-950 text-zinc-500 border-white/5'}`}>
               <Sparkles size={12} /> {t.sortRecommended}
             </button>
             <button onClick={() => setSortType('top-rated')} className={`shrink-0 px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${sortType === 'top-rated' ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-zinc-950 text-zinc-500 border-white/5'}`}>
               <Star size={12} /> {t.sortTopRated}
             </button>
             <button onClick={() => setSortType('price-low')} className={`shrink-0 px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${sortType === 'price-low' ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-zinc-950 text-zinc-500 border-white/5'}`}>
               <ArrowDownNarrowWide size={12} /> {t.sortPriceLow}
             </button>
          </div>
        </div>
      </section>

      {featuredBarbers.length > 0 && searchQuery === '' && (
        <section className="space-y-5 animate-slide-up">
           <div className="flex items-center gap-2 px-1">
             <Crown size={14} className="text-[#D4AF37]" />
             <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.3em]">Premium Odabir</span>
           </div>
           <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
              {featuredBarbers.map(barber => (
                <div key={barber.id} onClick={() => onSelectBarber(barber.id)} className="shrink-0 w-44 relative active:scale-95 transition-all cursor-pointer">
                  <div className="aspect-[3/4] rounded-[2.5rem] overflow-hidden border border-[#D4AF37]/30 shadow-2xl relative">
                    <SafeImage src={barber.profilePicture} className="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"></div>
                    <div className="absolute bottom-6 left-6 right-6">
                      <h4 className="text-white font-black text-sm italic uppercase tracking-tighter truncate">{barber.fullName}</h4>
                      <p className="text-[#D4AF37] text-[8px] font-black uppercase tracking-widest mt-1.5">{barber.neighborhood}</p>
                    </div>
                  </div>
                </div>
              ))}
           </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 px-1">
        <div className="flex items-center gap-2 mb-2">
          <SlidersHorizontal size={14} className="text-zinc-700" />
          <span className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em]">
            {filteredBarbers.length} {t.allProfessionals}
          </span>
        </div>
        {filteredBarbers.map(barber => (
          <div key={barber.id} onClick={() => onSelectBarber(barber.id)} className="cursor-pointer">
            <Card className={`flex gap-5 p-5 bg-[#0a0a0a] active:bg-zinc-950 transition-all rounded-[2.25rem] group border ${barber.weeklyWinner ? 'border-[#D4AF37]/50 shadow-[0_15px_50px_rgba(212,175,55,0.1)]' : 'border-white/5'}`}>
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/5">
                  <SafeImage src={barber.profilePicture} className="" />
                </div>
                {barber.weeklyWinner && <div className="absolute -top-1.5 -right-1.5 bg-[#D4AF37] p-1.5 rounded-lg border-2 border-black shadow-xl z-10"><Trophy size={10} className="text-black" /></div>}
              </div>
              <div className="flex-1 py-1 min-w-0 flex flex-col justify-between">
                <div>
                   <h3 className="font-black text-lg text-white tracking-tighter uppercase italic truncate leading-none">{barber.fullName}</h3>
                   <div className="flex items-center gap-2 mt-3">
                      <Badge variant={barber.workMode === 'mobile' ? 'gold' : 'neutral'} className="text-[7px]">{barber.workMode}</Badge>
                      <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest truncate">{barber.neighborhood}</span>
                   </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                     <Star size={10} className="text-[#D4AF37] fill-[#D4AF37]" />
                     <span className="text-white text-[10px] font-black italic">{barber.avgRating}</span>
                     <span className="text-zinc-600 text-[9px] font-bold ml-1">({barber.reviewCount})</span>
                  </div>
                  {barber.minPrice > 0 && (
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">
                      <span className="text-zinc-600 mr-1">{t.startingFrom}</span>
                      {barber.minPrice}€
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerHome;
