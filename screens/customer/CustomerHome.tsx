import React, { useState, useMemo } from 'react';
import { db } from '../../store/mockDatabase';
import { BarberProfile } from '../../types';
import { Card, Badge } from '../../components/UI';
import { translations, Language } from '../../translations';
import { MapPin, Search, Map as MapIcon, List, Trophy, Sparkles, Loader2, Crown, Star } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface CustomerHomeProps {
  onSelectBarber: (id: string) => void;
  lang: Language;
}

const CustomerHome: React.FC<CustomerHomeProps> = ({ onSelectBarber, lang }) => {
  const [selectedQuarter, setSelectedQuarter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewType, setViewType] = useState<'list' | 'map'>('list');
  const [isSearchingMaps, setIsSearchingMaps] = useState(false);

  const t = translations[lang];
  const barbers = db.getBarbersSync().filter(b => b.approved);
  
  const featuredBarbers = useMemo(() => barbers.filter(b => b.featured), [barbers]);

  const filteredBarbers = barbers.filter(b => {
    const matchQuarter = selectedQuarter === 'All' || b.neighborhood === selectedQuarter;
    const matchSearch = b.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      b.bio.toLowerCase().includes(searchQuery.toLowerCase());
    return matchQuarter && matchSearch;
  });

  const handleExploreOnMaps = async () => {
    setIsSearchingMaps(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Fix: Using gemini-2.5-flash as Google Maps grounding is only supported in Gemini 2.5 series models.
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: "Find high quality barbershops in Zagreb city center and list them.",
        config: { tools: [{ googleMaps: {} }] },
      });
      console.log(response.candidates?.[0]?.groundingMetadata?.groundingChunks);
    } catch (e) {
      console.error(e);
    } finally { setIsSearchingMaps(false); }
  };

  const SafeImage = ({ src, className }: { src: string, className: string }) => {
    const [error, setError] = useState(false);
    return (
      <img src={error ? "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=200" : src} 
           onError={() => setError(true)} className={className} alt="" />
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
          <button 
            onClick={() => setViewType(viewType === 'list' ? 'map' : 'list')}
            className="w-12 h-12 rounded-2xl bg-zinc-950 border border-white/5 flex items-center justify-center text-zinc-400 active:scale-90 transition-all shadow-xl"
          >
            {viewType === 'list' ? <MapIcon size={18} /> : <List size={18} />}
          </button>
        </div>

        <div className="relative group px-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-700" size={16} />
          <input
            type="text"
            placeholder={t.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0F0F0F] rounded-2xl pl-14 pr-6 py-5 border border-white/5 focus:border-[#C5A059] outline-none transition-all text-white text-xs font-bold shadow-2xl"
          />
        </div>
      </section>

      {viewType === 'list' && featuredBarbers.length > 0 && (
        <section className="space-y-5 animate-slide-up">
           <div className="flex items-center gap-2 px-1">
             <Crown size={14} className="text-[#D4AF37]" />
             <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.3em]">Premium Odabir</span>
           </div>
           <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
              {featuredBarbers.map(barber => (
                <div key={barber.id} onClick={() => onSelectBarber(barber.id)} className="shrink-0 w-44 relative active:scale-95 transition-all">
                  <div className="aspect-[3/4] rounded-[2.5rem] overflow-hidden border border-[#D4AF37]/30 shadow-2xl relative">
                    <SafeImage src={barber.profilePicture} className="w-full h-full object-cover grayscale brightness-75 hover:grayscale-0 transition-all duration-700" />
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

      {viewType === 'map' ? (
        <div className="relative h-[500px] bg-[#050505] rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl mx-1">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#C5A059_1px,transparent_1px)] [background-size:24px_24px]"></div>
          {filteredBarbers.map((b) => (
            <div key={b.id} className="absolute" style={{ top: `${Math.random() * 70 + 15}%`, left: `${Math.random() * 70 + 15}%` }}>
              <button 
                onClick={() => onSelectBarber(b.id)}
                className="p-1.5 rounded-full ring-2 ring-[#C5A059]/30 bg-black hover:scale-110 transition-all shadow-2xl"
              >
                <SafeImage src={b.profilePicture} className="w-12 h-12 rounded-full object-cover grayscale border-2 border-black" />
              </button>
            </div>
          ))}
          <div className="absolute bottom-8 left-8 right-8 space-y-3">
             <button onClick={handleExploreOnMaps} className="w-full h-16 bg-black/80 backdrop-blur border border-white/10 rounded-2xl flex items-center justify-center gap-4 text-white font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all">
                {isSearchingMaps ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="text-[#D4AF37]" />}
                Explore Cloud Network
             </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 px-1">
          <div className="flex items-center gap-2 mb-2">
            <List size={14} className="text-zinc-700" />
            <span className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em]">Aktivni Članovi</span>
          </div>
          {filteredBarbers.map(barber => (
            <Card key={barber.id} className={`flex gap-5 p-5 bg-[#0a0a0a] active:bg-zinc-950 transition-all rounded-[2.25rem] group border ${barber.weeklyWinner ? 'border-[#D4AF37]/50 shadow-[0_15px_50px_rgba(212,175,55,0.1)]' : 'border-white/5'}`} onClick={() => onSelectBarber(barber.id)}>
              <div className="relative shrink-0">
                <SafeImage src={barber.profilePicture} className="w-20 h-20 rounded-2xl object-cover grayscale brightness-90 group-hover:grayscale-0 transition-all duration-500 border border-white/5" />
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
                <div className="flex items-center gap-1">
                   <Star size={10} className="text-[#D4AF37] fill-current" />
                   <span className="text-zinc-500 text-[9px] font-bold">4.9 (124)</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerHome;