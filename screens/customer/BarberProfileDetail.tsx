
import React, { useState, useMemo } from 'react';
import { db } from '../../store/database';
import { Service, Booking, User, WorkingDay } from '../../types';
import { Button, Card, Badge } from '../../components/UI';
import { translations, Language } from '../../translations';
import { ArrowLeft, MapPin, Star, Clock, Heart, Info, ChevronRight, Scissors, Hourglass, Phone, Navigation, X, Images } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'info' | 'services'>('info');
  const [loading, setLoading] = useState(false);

  const t = translations[lang];
  const barber = db.getBarbersSync().find(b => b.id === barberId);

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
  const avgRating = reviews.length 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) 
    : "0.0";

  const timeSlots = useMemo(() => {
    if (!selectedDate || !barber) return [];

    const dateObj = new Date(selectedDate);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const dayConfig = (barber.workingHours || []).find((wh: WorkingDay) => wh.day === dayOfWeek);

    if (!dayConfig || !dayConfig.enabled) return [];

    const slots: { time: string; isTaken: boolean }[] = [];
    const interval = barber.slotInterval || 45;
    
    const activeOnDate = barberBookings.filter(b => 
      b.date === selectedDate && (b.status === 'accepted' || b.status === 'pending')
    );
    const takenTimes = activeOnDate.map(b => b.time);

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
          isTaken: takenTimes.indexOf(timeStr) !== -1
        });
      }
      current += interval;
    }

    return slots;
  }, [selectedDate, barber, barberBookings]);

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

  const handleOpenInMaps = () => {
    const fullAddress = `${barber.address}, ${(barber as any).zipCode || ''} ${(barber as any).city || 'Zagreb'}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    window.open(url, '_blank');
  };

  const handleBook = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !barber) return;
    setLoading(true);

    const newBooking: Booking = {
      id: Math.random().toString(36).substring(2, 11),
      customerId: user.id,
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

    const success = await db.createBooking(newBooking);
    if (success) {
      setStep('success');
    }
    setLoading(false);
  };

  const SafeImage = ({ src, className, isAvatar = false }: { src: string, className: string, isAvatar?: boolean }) => {
    const [error, setError] = useState(false);
    const fallback = isAvatar 
      ? "https://i.ibb.co/C5fL3Pz/trimly-logo.png" 
      : "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600";
    return (
      <img 
        src={error || !src ? fallback : src} 
        onError={() => setError(true)} 
        className={`${className} object-cover w-full h-full`} 
        alt="" 
      />
    );
  };

  if (step === 'success') return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black p-10 text-center animate-lux-fade">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-[#D4AF37]/20 blur-3xl rounded-full"></div>
        <div className="w-24 h-24 bg-zinc-900 rounded-[2.5rem] border border-[#D4AF37]/30 flex items-center justify-center relative z-10 shadow-2xl">
          <Hourglass className="text-[#D4AF37] animate-pulse" size={40} />
        </div>
      </div>
      <h2 className="text-white font-black text-2xl italic uppercase tracking-tighter">Zahtjev poslan!</h2>
      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mt-6 max-w-[240px] leading-relaxed">
        Barber će primiti obavijest i potvrditi vaš termin u najkraćem roku.
      </p>
      <Button onClick={onBack} className="mt-12 w-full h-18 text-[11px] font-black tracking-widest uppercase">Završi</Button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white overflow-y-auto animate-lux-fade scrollbar-hide pb-32">
      {/* Sticky Header */}
      <div className="sticky top-0 left-0 right-0 z-50 bg-black/90 premium-blur border-b border-white/5 px-6 py-4 flex justify-between items-center pt-safe">
        <button onClick={onBack} className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-400 active:scale-90 transition-all border border-white/5">
          <ArrowLeft size={18} />
        </button>
        <div className="flex gap-2">
           {barber.phoneNumber && (
             <a href={`tel:${barber.phoneNumber}`} className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-xl active:scale-90 transition-all">
               <Phone size={16} className="text-black" />
             </a>
           )}
           <button className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-500 border border-white/5 active:scale-90 transition-all">
             <Heart size={18} />
           </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-10 min-h-screen">
        <div className="flex flex-col items-start gap-6">
          {/* Fiksni kvadratni profilni okvir u boji */}
          <div className="w-24 h-24 bg-zinc-900 border border-white/10 rounded-[1.75rem] overflow-hidden shadow-2xl flex-shrink-0">
            <SafeImage src={barber.profilePicture} className="" isAvatar={true} />
          </div>
          
          <div className="flex justify-between items-end w-full">
            <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">{barber.fullName}</h1>
              <div className="flex flex-wrap gap-2">
                <Badge variant="gold"><Star size={10} className="mr-1 fill-current" /> {avgRating}</Badge>
                <Badge variant="neutral"><Scissors size={10} className="mr-1" /> {totalCuts} šišanja</Badge>
              </div>
            </div>
            <div className="bg-[#D4AF37] text-black px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest self-start">{barber.workMode}</div>
          </div>
        </div>

        {/* Galerija radova u boji */}
        {barber.gallery && barber.gallery.length > 0 && (
          <section className="space-y-4 pt-2">
             <div className="flex items-center gap-3">
                <Images size={14} className="text-[#D4AF37]" />
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Galerija radova</span>
             </div>
             <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                {barber.gallery.map((img, idx) => (
                  <div key={idx} className="shrink-0 w-60 aspect-[3/4] rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl">
                    <SafeImage src={img} className="transition-all duration-700" />
                  </div>
                ))}
             </div>
          </section>
        )}

        <div className="flex bg-zinc-950 p-1.5 rounded-3xl border border-white/5">
           <button onClick={() => setActiveTab('info')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${activeTab === 'info' ? 'bg-white/10 text-[#D4AF37]' : 'text-zinc-600'}`}>Info</button>
           <button onClick={() => setActiveTab('services')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${activeTab === 'services' ? 'bg-white/10 text-[#D4AF37]' : 'text-zinc-600'}`}>Usluge</button>
        </div>

        {activeTab === 'info' ? (
          <div className="space-y-12 animate-lux-fade pb-20">
             <section className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-600 font-black uppercase text-[9px] tracking-[0.3em]"><MapPin size={14} className="text-[#D4AF37]" /> LOKACIJA</div>
                <Card className="p-6 bg-zinc-900/40 border-white/5">
                  <p className="text-white font-black text-sm italic mb-4">
                    {barber.address}, {(barber as any).zipCode || ''} {(barber as any).city || 'Zagreb'}
                  </p>
                  <Button onClick={handleOpenInMaps} variant="secondary" className="h-14 text-[9px] flex items-center justify-center gap-2">
                    <Navigation size={14} /> Otvori u Google Kartama
                  </Button>
                </Card>
             </section>
             <section className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-600 font-black uppercase text-[9px] tracking-[0.3em]"><Info size={14} className="text-[#D4AF37]" /> BIO</div>
                <p className="text-zinc-400 leading-relaxed italic text-xs font-bold px-6 py-5 bg-zinc-950 rounded-3xl border border-white/5">{barber.bio || 'Barber nije dodao opis.'}</p>
             </section>
          </div>
        ) : (
          <div className="space-y-4 animate-lux-fade pb-20">
            {services.length === 0 ? (
               <div className="py-20 text-center opacity-30 italic text-xs">Ovaj barber još nije dodao usluge.</div>
            ) : services.map(s => (
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
        )}
      </div>

      {/* Booking Drawer */}
      {selectedService && (
        <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-white/10 p-8 z-[110] rounded-t-[3.5rem] shadow-2xl animate-slide-up space-y-8 premium-blur pb-safe">
          <button 
            onClick={() => { setSelectedService(null); setSelectedDate(''); setSelectedTime(''); }}
            className="absolute top-6 right-8 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-zinc-500 active:scale-90 transition-all"
          >
            <X size={18} />
          </button>

          <div className="pt-4">
             <h3 className="text-white font-black text-sm uppercase italic tracking-tighter">Odaberite Termin</h3>
             <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest mt-1">Usluga: {selectedService.name}</p>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {availableDates.map(d => (
              <button key={d.full} onClick={() => { setSelectedDate(d.full); setSelectedTime(''); }} className={`shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border ${selectedDate === d.full ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-xl scale-105' : 'bg-zinc-900 border-white/5 text-zinc-600'}`}>
                <span className="text-[8px] font-black uppercase tracking-widest opacity-60">{d.dayName}</span>
                <span className="text-xl font-black italic tracking-tighter">{d.dayNum}</span>
              </button>
            ))}
          </div>

          {selectedDate && (
            <div className="grid grid-cols-4 gap-2.5 animate-lux-fade">
              {timeSlots.length === 0 ? (
                <div className="col-span-4 py-8 text-center text-[9px] font-black uppercase tracking-widest text-zinc-600">Nema dostupnih termina za ovaj dan.</div>
              ) : timeSlots.map(slot => (
                <button 
                  key={slot.time} 
                  disabled={slot.isTaken} 
                  onClick={() => setSelectedTime(slot.time)} 
                  className={`py-3.5 rounded-xl border text-[9px] font-black tracking-widest transition-all ${slot.isTaken ? 'bg-zinc-950/20 text-zinc-900 border-transparent opacity-20 cursor-not-allowed' : selectedTime === slot.time ? 'bg-white text-black border-white shadow-2xl scale-105' : 'bg-zinc-950 text-zinc-600 border-white/5'}`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
          
          <Button disabled={!selectedTime || loading} loading={loading} onClick={handleBook} className="w-full h-18 text-xs font-black uppercase tracking-widest">
            Potvrdi Rezervaciju
          </Button>
        </div>
      )}
    </div>
  );
};

export default BarberProfileDetail;
