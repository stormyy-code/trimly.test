
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../store/database';
import { Service, Booking, User, WorkingDay, Review } from '../../types';
import { Button, Card, Badge, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { ArrowLeft, MapPin, Star, Clock, Heart, Info, ChevronRight, Scissors, Hourglass, Phone, Navigation, X, Images, Loader2, MessageSquare, BarChart3, AlertTriangle, Mail, User as UserIcon } from 'lucide-react';

interface BarberProfileDetailProps {
  barberId: string;
  onBack: () => void;
  user: User;
  lang: Language;
}

interface DateOption {
  full: string;
  dayName: string;
  dayNum: number;
}

const BarberProfileDetail: React.FC<BarberProfileDetailProps> = ({ barberId, onBack, user, lang }) => {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [activeTab, setActiveTab] = useState<'info' | 'services' | 'reviews'>('info');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>(db.getUsersSync());

  const t = translations[lang];
  const barber = db.getBarbersSync().find(b => b.id === barberId);

  useEffect(() => {
    db.getUsers().then(setAllUsers);
    
    const handleRegistryUpdate = (e: any) => {
      setAllUsers(e.detail?.users || db.getUsersSync());
    };
    window.addEventListener('users-registry-updated', handleRegistryUpdate);
    return () => window.removeEventListener('users-registry-updated', handleRegistryUpdate);
  }, []);

  if (!barber) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-10 text-center">
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px] mb-6">Profil nije pronađen</p>
        <Button onClick={onBack}>Povratak</Button>
      </div>
    );
  }

  const services = db.getServicesSync().filter(s => s.barberId === barberId);
  const reviews = db.getReviewsSync().filter(r => r.barberId === barberId);
  const barberBookings = db.getBookingsSync().filter(b => b.barberId === barberId);
  
  const totalCuts = barberBookings.filter(b => b.status === 'completed').length;
  const avgRatingValue = reviews.length 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
    : 0;
  const avgRating = avgRatingValue.toFixed(1);

  const timeSlots = useMemo(() => {
    if (!selectedDate || !barber) return [];

    const dateObj = new Date(selectedDate);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const dayConfig = (barber.workingHours || []).find((wh: WorkingDay) => wh.day === dayOfWeek);

    if (!dayConfig || !dayConfig.enabled) return [];

    const slots: { time: string; isTaken: boolean; isRequested: boolean }[] = [];
    const interval = barber.slotInterval || 45;
    
    // KLJUČNA PROMJENA: Slot je "IsTaken" samo ako je već netko PRIHVAĆEN (status 'accepted')
    const takenTimes = barberBookings
      .filter(b => b.date === selectedDate && b.status === 'accepted')
      .map(b => b.time);

    // Provjeravamo je li trenutni korisnik već poslao zahtjev za ovaj slot
    const requestedByMe = barberBookings
      .filter(b => b.date === selectedDate && b.customerId === user.id && b.status === 'pending')
      .map(b => b.time);

    const breaks = dayConfig.breaks || [];

    const timeToMinutes = (tStr: string) => {
      const p = tStr.split(':');
      return (parseInt(p[0]) * 60) + parseInt(p[1]);
    };

    const minutesToTime = (m: number) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    };

    let current = timeToMinutes(dayConfig.startTime);
    const endTimeInMinutes = timeToMinutes(dayConfig.endTime);

    while (current + interval <= endTimeInMinutes) {
      const timeStr = minutesToTime(current);
      const isDuringBreak = breaks.some(brk => {
        const bStart = timeToMinutes(brk.startTime);
        const bEnd = timeToMinutes(brk.endTime);
        return current >= bStart && current < bEnd;
      });

      if (!isDuringBreak) {
        slots.push({
          time: timeStr,
          isTaken: takenTimes.includes(timeStr),
          isRequested: requestedByMe.includes(timeStr)
        });
      }
      current += interval;
    }
    return slots;
  }, [selectedDate, barber, barberBookings, user.id]);

  const availableDates = useMemo(() => {
    const dates: DateOption[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push({
        full: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString(lang === 'hr' ? 'hr-HR' : 'en-US', { weekday: 'short' }),
        dayNum: d.getDate()
      });
    }
    return dates;
  }, [lang]);

  const handleBook = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !barber) return;
    setLoading(true);

    try {
      const finalCustomerName = db.getUserNameById(user.id, user.fullName || user.email.split('@')[0]);

      const newBooking: Booking = {
        id: crypto.randomUUID(),
        customerId: user.id,
        customerName: finalCustomerName,
        customerEmail: user.email,
        barberId: barber.id,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        date: selectedDate,
        time: selectedTime,
        price: selectedService.price,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const result = await db.createBooking(newBooking);
      if (result.success) {
        setStep('success');
      } else {
        setToast({ 
          message: lang === 'hr' ? `Rezervacija nije uspjela: ${result.error}` : `Booking failed: ${result.error}`, 
          type: 'error' 
        });
      }
    } catch (err: any) {
      setToast({ 
        message: lang === 'hr' ? `Greška: ${err.message}` : `Error: ${err.message}`, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const SafeImage = ({ src, className, isAvatar = false }: { src: string, className: string, isAvatar?: boolean }) => {
    const [err, setErr] = useState(false);
    const fb = isAvatar ? "https://i.ibb.co/C5fL3Pz/trimly-logo.png" : "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600";
    return <img src={err || !src ? fb : src} onError={() => setErr(true)} className={`${className} object-cover w-full h-full`} alt="" />;
  };

  if (step === 'success') return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black p-10 text-center animate-lux-fade">
      <div className="w-24 h-24 bg-zinc-900 rounded-[2.5rem] border border-[#D4AF37]/30 flex items-center justify-center relative z-10 shadow-2xl mb-8">
        <Hourglass className="text-[#D4AF37] animate-pulse" size={40} />
      </div>
      <h2 className="text-white font-black text-2xl italic uppercase tracking-tighter">{lang === 'hr' ? 'UPIT POSLAN!' : 'REQUEST SENT!'}</h2>
      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mt-6 max-w-[240px] leading-relaxed">
        {lang === 'hr' ? 'Više klijenata može tražiti ovaj termin. Barber će odabrati koga prihvaća, o čemu ćete dobiti obavijest.' : 'Multiple clients can request this slot. The barber will choose who to accept, and you will be notified.'}
      </p>
      <Button onClick={onBack} className="mt-12 w-full h-18 text-[11px] font-black tracking-widest uppercase">Završi</Button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white overflow-y-auto animate-lux-fade scrollbar-hide pb-32">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="sticky top-0 left-0 right-0 z-50 bg-black/90 premium-blur border-b border-white/5 px-6 py-4 flex justify-between items-center pt-safe">
        <button onClick={onBack} className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-400 border border-white/5">
          <ArrowLeft size={18} />
        </button>
        <div className="flex gap-2">
           {barber.phoneNumber && (
             <a href={`tel:${barber.phoneNumber}`} className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-xl">
               <Phone size={16} className="text-black" />
             </a>
           )}
           <button className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-500 border border-white/5">
             <Heart size={18} />
           </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-10 min-h-screen">
        <div className="flex flex-col items-start gap-6">
          <div className="w-24 h-24 bg-zinc-900 border border-white/10 rounded-[1.75rem] overflow-hidden shadow-2xl flex-shrink-0">
            <SafeImage src={barber.profilePicture} className="" isAvatar={true} />
          </div>
          
          <div className="flex justify-between items-end w-full">
            <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">
                {barber.fullName}
              </h1>
              <div className="flex flex-wrap gap-2">
                <Badge variant="gold"><Star size={10} className="mr-1 fill-current" /> {avgRating}</Badge>
                <Badge variant="neutral"><Scissors size={10} className="mr-1" /> {totalCuts} šišanja</Badge>
              </div>
            </div>
            <div className="bg-[#D4AF37] text-black px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest self-start">{barber.workMode}</div>
          </div>
        </div>

        <div className="flex bg-zinc-950 p-1.5 rounded-3xl border border-white/5">
           <button onClick={() => setActiveTab('info')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${activeTab === 'info' ? 'bg-white/10 text-[#D4AF37]' : 'text-zinc-600'}`}>Info</button>
           <button onClick={() => setActiveTab('services')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${activeTab === 'services' ? 'bg-white/10 text-[#D4AF37]' : 'text-zinc-600'}`}>Usluge</button>
           <button onClick={() => setActiveTab('reviews')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${activeTab === 'reviews' ? 'bg-white/10 text-[#D4AF37]' : 'text-zinc-600'}`}>Recenzije</button>
        </div>

        {activeTab === 'info' ? (
          <div className="space-y-12 animate-lux-fade pb-20">
             <section className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-600 font-black uppercase text-[9px] tracking-[0.3em]"><MapPin size={14} className="text-[#D4AF37]" /> LOKACIJA</div>
                <Card className="p-6 bg-zinc-900/40 border-white/5">
                  <p className="text-white font-black text-sm italic mb-4">
                    {barber.address}, {barber.city || 'Zagreb'}
                  </p>
                  <Button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(barber.address)}`, '_blank')} variant="secondary" className="h-14 text-[9px] flex items-center justify-center gap-2">
                    <Navigation size={14} /> Otvori u Google Kartama
                  </Button>
                </Card>
             </section>
             <section className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-600 font-black uppercase text-[9px] tracking-[0.3em]"><Info size={14} className="text-[#D4AF37]" /> BIO</div>
                <p className="text-zinc-400 leading-relaxed italic text-xs font-bold px-6 py-5 bg-zinc-950 rounded-3xl border border-white/5">{barber.bio || 'Barber nije dodao opis.'}</p>
             </section>
          </div>
        ) : activeTab === 'services' ? (
          <div className="space-y-4 animate-lux-fade pb-20">
            {services.map(s => (
              <Card key={s.id} onClick={() => setSelectedService(s)} className={`p-6 flex gap-6 items-center bg-zinc-950/50 border transition-all rounded-[2.5rem] ${selectedService?.id === s.id ? 'border-[#D4AF37] bg-[#D4AF37]/5 shadow-2xl scale-[1.02]' : 'border-white/5'}`}>
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0">
                  <SafeImage src={s.imageUrl || ''} className="" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-lg uppercase tracking-tighter text-white italic truncate leading-none">{s.name}</h4>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-[#D4AF37] text-sm font-black">{s.price}€</span>
                    <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Clock size={10} /> {s.duration || '45 min'}</span>
                  </div>
                </div>
                <ChevronRight size={20} className={selectedService?.id === s.id ? 'text-[#D4AF37]' : 'text-zinc-800'} />
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6 animate-lux-fade pb-20">
             {reviews.length === 0 ? <div className="py-24 text-center opacity-20 italic text-xs">Nema recenzija.</div> : reviews.map(r => (
               <Card key={r.id} className="p-6 bg-zinc-950/30 border-white/5 rounded-[2rem] space-y-3">
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-white italic uppercase">{r.customerName}</span>
                    <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={10} className={s <= r.rating ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-zinc-800'} />)}</div>
                 </div>
                 <p className="text-zinc-400 text-xs italic">"{r.comment}"</p>
               </Card>
             ))}
          </div>
        )}
      </div>

      {selectedService && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/10 p-8 z-[150] rounded-t-[3.5rem] shadow-2xl animate-slide-up space-y-8 premium-blur pb-safe">
          <button onClick={() => { setSelectedService(null); setSelectedDate(''); setSelectedTime(''); }} className="absolute top-6 right-8 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-zinc-500"><X size={18} /></button>
          <div className="pt-4">
             <h3 className="text-white font-black text-sm uppercase italic tracking-tighter">Odaberite Termin</h3>
             <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest mt-1">Usluga: {selectedService.name}</p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {availableDates.map(d => (
              <button key={d.full} onClick={() => { setSelectedDate(d.full); setSelectedTime(''); }} className={`shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all border ${selectedDate === d.full ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-zinc-900 border-white/5 text-zinc-600'}`}>
                <span className="text-[8px] font-black uppercase tracking-widest opacity-60">{d.dayName}</span>
                <span className="text-xl font-black italic">{d.dayNum}</span>
              </button>
            ))}
          </div>
          {selectedDate && (
            <div className="grid grid-cols-4 gap-2 animate-lux-fade">
              {timeSlots.map(slot => (
                <button 
                  key={slot.time} 
                  disabled={slot.isTaken || slot.isRequested} 
                  onClick={() => setSelectedTime(slot.time)} 
                  className={`py-3.5 rounded-xl border text-[9px] font-black transition-all ${
                    slot.isTaken 
                      ? 'bg-red-500/10 text-red-500 border-red-500/20 opacity-50 cursor-not-allowed' 
                      : slot.isRequested
                        ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 cursor-wait'
                        : selectedTime === slot.time 
                          ? 'bg-white text-black border-white' 
                          : 'bg-zinc-950 text-zinc-600 border-white/5'
                  }`}
                >
                  {slot.isTaken ? 'ZAUZETO' : slot.isRequested ? 'U OBRADI' : slot.time}
                </button>
              ))}
            </div>
          )}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
             <AlertTriangle className="text-amber-500 shrink-0" size={16} />
             <p className="text-[8px] font-black text-white uppercase tracking-widest">Više ljudi može tražiti ovaj slot. Barber bira tko dobiva termin.</p>
          </div>
          <Button disabled={!selectedTime || loading} loading={loading} onClick={handleBook} className="w-full h-18 text-xs font-black">Pošalji Zahtjev</Button>
        </div>
      )}
    </div>
  );
};

export default BarberProfileDetail;
