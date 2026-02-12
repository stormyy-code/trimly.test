
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../store/database';
import { Service, Booking, User, WorkingDay, Review } from '../../types';
import { Button, Card, Badge, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { ArrowLeft, MapPin, Star, Clock, Heart, Info, ChevronRight, Scissors, Hourglass, Phone, Navigation, X, Images, Loader2, MessageSquare, AlertTriangle, Mail, User as UserIcon, ZoomIn, Users } from 'lucide-react';

interface BarberProfileDetailProps {
  barberId: string;
  onBack: () => void;
  user: User;
  lang: Language;
}

const BarberProfileDetail: React.FC<BarberProfileDetailProps> = ({ barberId, onBack, user, lang }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [activeTab, setActiveTab] = useState<'info' | 'services' | 'reviews'>('info');
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [selectedGalleryImg, setSelectedGalleryImg] = useState<string | null>(null);

  const t = translations[lang];
  const barber = db.getBarbersSync().find(b => b.id === barberId);

  useEffect(() => {
    // Check favorite status
    const storedFavs = localStorage.getItem(`trimly_favs_${user.id}`);
    if (storedFavs) {
      const favsList = JSON.parse(storedFavs);
      setIsFavorite(favsList.includes(barberId));
    }

    setServicesLoading(true);
    db.getServices(barberId).then(data => {
      setServices(data);
      setServicesLoading(false);
    });

    setReviewsLoading(true);
    db.getReviews(barberId).then(data => {
      setReviews(data);
      setReviewsLoading(false);
    });
  }, [barberId, user.id]);

  const toggleFavorite = () => {
    const storedFavs = localStorage.getItem(`trimly_favs_${user.id}`);
    let favsList = storedFavs ? JSON.parse(storedFavs) : [];
    if (favsList.includes(barberId)) {
      favsList = favsList.filter((id: string) => id !== barberId);
      setIsFavorite(false);
    } else {
      favsList.push(barberId);
      setIsFavorite(true);
    }
    localStorage.setItem(`trimly_favs_${user.id}`, JSON.stringify(favsList));
  };

  if (!barber) return null;

  const barberBookings = db.getBookingsSync().filter(b => b.barberId === barberId);
  const avgRatingValue = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) : 0;
  const avgRating = avgRatingValue.toFixed(1);

  const timeSlots = useMemo(() => {
    if (!selectedDate || !barber) return [];
    const dateObj = new Date(selectedDate);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const dayConfig = (barber.workingHours || []).find((wh: WorkingDay) => wh.day === dayOfWeek);
    if (!dayConfig || !dayConfig.enabled) return [];
    const slots: { time: string; isTaken: boolean; }[] = [];
    const interval = barber.slotInterval || 45;
    const takenTimes = barberBookings.filter(b => b.date === selectedDate && b.status === 'accepted').map(b => b.time);
    const timeToMinutes = (tStr: string) => { const p = tStr.split(':'); return (parseInt(p[0]) * 60) + parseInt(p[1]); };
    const minutesToTime = (m: number) => { const h = Math.floor(m / 60); const min = m % 60; return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`; };
    let current = timeToMinutes(dayConfig.startTime);
    const endTimeInMinutes = timeToMinutes(dayConfig.endTime);
    while (current + interval <= endTimeInMinutes) {
      const timeStr = minutesToTime(current);
      slots.push({ time: timeStr, isTaken: takenTimes.includes(timeStr) });
      current += interval;
    }
    return slots;
  }, [selectedDate, barber, barberBookings]);

  const availableDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      dates.push({
        full: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString(lang === 'hr' ? 'hr-HR' : 'en-US', { weekday: 'short' }),
        dayNum: d.getDate()
      });
    }
    return dates;
  }, [lang]);

  const handleBook = async () => {
    if (!selectedService || !selectedDate || !selectedTime) return;
    setLoading(true);
    try {
      const newBooking: Booking = {
        id: crypto.randomUUID(), customerId: user.id, customerName: user.fullName || user.email.split('@')[0], customerEmail: user.email,
        barberId: barber.id, serviceId: selectedService.id, serviceName: selectedService.name,
        date: selectedDate, time: selectedTime, price: selectedService.price, status: 'pending', createdAt: new Date().toISOString()
      };
      const result = await db.createBooking(newBooking);
      if (result.success) setStep('success');
      else setToast({ message: 'Greška pri slanju.', type: 'error' });
    } catch (err: any) { setToast({ message: 'Greška!', type: 'error' }); }
    finally { setLoading(false); }
  };

  const getWorkModeLabel = (mode: string) => {
    if (mode === 'classic') return 'CLASSIC';
    if (mode === 'mobile') return 'MOBILE';
    return 'CLASSIC/MOBILE';
  };

  if (step === 'success') return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black p-10 text-center animate-lux-fade">
      <div className="w-24 h-24 bg-zinc-900 rounded-[2.5rem] border border-[#D4AF37]/30 flex items-center justify-center shadow-2xl mb-8"><Hourglass className="text-[#D4AF37] animate-pulse" size={40} /></div>
      <h2 className="text-white font-black text-2xl italic uppercase tracking-tighter">ZAHTJEV POSLAN!</h2>
      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mt-6 max-w-[240px] leading-relaxed">Barber će odabrati klijenta za ovaj termin. Obavijestit ćemo vas čim status bude ažuriran.</p>
      <Button onClick={onBack} className="mt-12 w-full h-18 text-[11px] font-black uppercase">Završi</Button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white overflow-y-auto animate-lux-fade scrollbar-hide pb-32">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="sticky top-0 left-0 right-0 z-50 bg-black/90 premium-blur border-b border-white/5 px-6 py-4 flex justify-between items-center pt-safe">
        <button onClick={onBack} className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-400 border border-white/5"><ArrowLeft size={18} /></button>
        <div className="flex gap-2">
           {barber.phoneNumber && <a href={`tel:${barber.phoneNumber}`} className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center"><Phone size={16} className="text-black" /></a>}
           <button 
             onClick={toggleFavorite}
             className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isFavorite ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-zinc-500'}`}
           >
             <Heart size={18} className={isFavorite ? 'fill-current' : ''} />
           </button>
        </div>
      </div>

      <div className="px-6 py-8 space-y-10 min-h-screen">
        <div className="flex flex-col items-start gap-6">
          <div className="w-24 h-24 bg-zinc-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex-shrink-0">
            <img src={barber.profilePicture} className="w-full h-full object-cover" />
          </div>
          <div className="flex justify-between items-end w-full">
            <div className="space-y-4">
              <h1 className="text-3xl font-black tracking-tighter uppercase italic leading-none">{barber.fullName}</h1>
              <div className="flex gap-2">
                <Badge variant="gold"><Star size={10} className="mr-1 fill-current" /> {avgRating}</Badge>
                <Badge variant="neutral">{barber.neighborhood}</Badge>
              </div>
            </div>
            <div className="bg-[#D4AF37] text-black px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest self-start">
              {getWorkModeLabel(barber.workMode)}
            </div>
          </div>
        </div>

        <div className="flex bg-zinc-950 p-1 rounded-3xl border border-white/5 overflow-x-auto scrollbar-hide">
           <button onClick={() => setActiveTab('info')} className={`shrink-0 flex-1 px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${activeTab === 'info' ? 'bg-white/10 text-[#D4AF37]' : 'text-zinc-600'}`}>Info</button>
           <button onClick={() => setActiveTab('services')} className={`shrink-0 flex-1 px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${activeTab === 'services' ? 'bg-white/10 text-[#D4AF37]' : 'text-zinc-600'}`}>Usluge</button>
           <button onClick={() => setActiveTab('reviews')} className={`shrink-0 flex-1 px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${activeTab === 'reviews' ? 'bg-white/10 text-[#D4AF37]' : 'text-zinc-600'}`}>Recenzije</button>
        </div>

        {activeTab === 'services' ? (
          <div className="space-y-4 animate-lux-fade pb-20">
            {services.map(s => (
              <Card key={s.id} onClick={() => setSelectedService(s)} className={`p-4 flex gap-4 items-center bg-zinc-950/50 border transition-all rounded-[2.25rem] ${selectedService?.id === s.id ? 'border-[#D4AF37] bg-[#D4AF37]/5 scale-[1.02]' : 'border-white/5'}`}>
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0"><img src={s.imageUrl} className="w-full h-full object-cover" /></div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-base uppercase tracking-tighter text-white italic truncate leading-none">{s.name}</h4>
                  <div className="flex items-center gap-4 mt-2"><span className="text-[#D4AF37] text-sm font-black">{s.price}€</span><span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Clock size={10} /> {s.duration || '45 min'}</span></div>
                </div>
                <ChevronRight size={18} className={selectedService?.id === s.id ? 'text-[#D4AF37]' : 'text-zinc-800'} />
              </Card>
            ))}
          </div>
        ) : activeTab === 'reviews' ? (
          <div className="space-y-4 animate-lux-fade pb-20">
             {reviews.map(r => (
               <Card key={r.id} className="p-6 bg-zinc-950/30 border-white/5 rounded-[2rem] space-y-3">
                 <div className="flex justify-between items-center"><span className="text-xs font-black text-white italic uppercase">{r.customerName}</span><div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={8} className={s <= r.rating ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-zinc-800'} />)}</div></div>
                 <p className="text-zinc-500 text-xs italic">"{r.comment}"</p>
               </Card>
             ))}
             {reviews.length === 0 && <div className="py-24 text-center opacity-20 text-[9px] font-black uppercase tracking-widest italic">Još nema recenzija</div>}
          </div>
        ) : (
          <div className="space-y-10 animate-lux-fade pb-20">
             <section className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-600 font-black uppercase text-[8px] tracking-widest"><MapPin size={12} className="text-[#D4AF37]" /> LOKACIJA</div>
                <Card className="p-6 bg-zinc-900/40 border-white/5">
                  <p className="text-white font-black text-sm italic mb-4">{barber.address}, {barber.city || 'Zagreb'}</p>
                  <Button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(barber.address)}`, '_blank')} variant="secondary" className="h-14 text-[8px] flex items-center justify-center gap-2"><Navigation size={12} /> Otvori u Google Kartama</Button>
                </Card>
             </section>
             <section className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-600 font-black uppercase text-[8px] tracking-widest"><Info size={12} className="text-[#D4AF37]" /> BIO</div>
                <p className="text-zinc-500 leading-relaxed italic text-xs font-bold bg-zinc-950 p-6 rounded-[2rem] border border-white/5">{barber.bio || 'Nema opisa.'}</p>
             </section>

             <section className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-600 font-black uppercase text-[8px] tracking-widest"><Images size={12} className="text-[#D4AF37]" /> GALERIJA RADOVA</div>
                <div className="grid grid-cols-2 gap-4">
                  {barber.gallery && barber.gallery.length > 0 ? (
                    barber.gallery.map((img, i) => (
                      <div key={i} onClick={() => setSelectedGalleryImg(img)} className="aspect-square rounded-[2rem] overflow-hidden border border-white/5 shadow-xl relative group">
                         <img src={img} className="w-full h-full object-cover transition-transform group-active:scale-110" />
                         <div className="absolute inset-0 bg-black/20 opacity-0 group-active:opacity-100 transition-opacity flex items-center justify-center"><ZoomIn size={24} className="text-white" /></div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 py-12 text-center opacity-20 text-[9px] font-black uppercase tracking-widest italic">Barber još nije postavio slike radova</div>
                  )}
                </div>
             </section>
          </div>
        )}
      </div>

      {selectedGalleryImg && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-lux-fade">
           <button onClick={() => setSelectedGalleryImg(null)} className="absolute top-10 right-10 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white"><X size={24} /></button>
           <img src={selectedGalleryImg} className="max-w-full max-h-[70vh] rounded-[3rem] shadow-2xl border border-white/10 object-contain" />
        </div>
      )}

      {selectedService && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#050505] border-t border-white/10 p-8 z-[150] rounded-t-[3rem] shadow-[0_-20px_80px_rgba(0,0,0,0.8)] animate-slide-up space-y-8 premium-blur pb-safe">
          <button onClick={() => { setSelectedService(null); setSelectedDate(''); setSelectedTime(''); }} className="absolute top-6 right-8 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-zinc-500"><X size={18} /></button>
          <div className="pt-2"><h3 className="text-white font-black text-sm uppercase italic tracking-tighter">Odaberite Datum</h3></div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {availableDates.map(d => (
              <button key={d.full} onClick={() => { setSelectedDate(d.full); setSelectedTime(''); }} className={`shrink-0 w-16 h-20 rounded-[1.5rem] flex flex-col items-center justify-center transition-all border ${selectedDate === d.full ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-zinc-950 border-white/5 text-zinc-600'}`}><span className="text-[7px] font-black uppercase tracking-widest opacity-60">{d.dayName}</span><span className="text-lg font-black italic">{d.dayNum}</span></button>
            ))}
          </div>
          {selectedDate && (
            <div className="grid grid-cols-4 gap-2 animate-lux-fade">
              {timeSlots.map(slot => (
                <button key={slot.time} disabled={slot.isTaken} onClick={() => setSelectedTime(slot.time)} className={`py-4 rounded-xl border text-[10px] font-black transition-all ${slot.isTaken ? 'bg-red-500/10 text-red-500 border-red-500/20 opacity-40' : selectedTime === slot.time ? 'bg-white text-black border-white scale-[1.05] shadow-2xl' : 'bg-zinc-950 text-zinc-500 border-white/5'}`}>{slot.isTaken ? 'ZAUZETO' : slot.time}</button>
              ))}
            </div>
          )}
          <Button disabled={!selectedTime || loading} loading={loading} onClick={handleBook} className="w-full h-18 text-xs font-black">Pošalji Zahtjev</Button>
        </div>
      )}
    </div>
  );
};

export default BarberProfileDetail;
