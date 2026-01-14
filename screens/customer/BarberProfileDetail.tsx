
import React, { useState, useMemo } from 'react';
import { db } from '../../store/database';
import { Service, Booking, User, WorkingDay } from '../../types';
import { Button, Card, Badge } from '../../components/UI';
import { translations, Language } from '../../translations';
import { ArrowLeft, MapPin, Star, Clock, Heart, Info, ChevronRight, UserCircle2, Scissors, Hourglass, Phone, Navigation } from 'lucide-react';

interface BarberProfileDetailProps {
  barberId: string;
  onBack: () => void;
  user: User;
  lang: Language;
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
    : "4.8";

  const timeSlots = useMemo(() => {
    if (!selectedDate || !barber) return [];

    const dateObj = new Date(selectedDate);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const dayConfig = (barber.workingHours || []).find((wh: WorkingDay) => wh.day === dayOfWeek);

    if (!dayConfig || !dayConfig.enabled) return [];

    const slots: { time: string, isTaken: boolean }[] = [];
    const interval = barber.slotInterval || 45;
    
    const timeToMinutes = (tStr: string) => {
      const parts = tStr.split(':');
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    };

    const minutesToTime = (m: number) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    };

    let current = timeToMinutes(dayConfig.startTime);
    const end = timeToMinutes(dayConfig.endTime);
    const takenTimes = barberBookings
      .filter(b => b.date === selectedDate && (b.status === 'accepted' || b.status === 'pending'))
      .map(b => b.time);

    const breaks = dayConfig.breaks || [];

    while (current + interval <= end) {
      const timeStr = minutesToTime(current);
      
      const isDuringBreak = breaks.some(brk => {
        const bStart = timeToMinutes(brk.startTime);
        const bEnd = timeToMinutes(brk.endTime);
        return (current >= bStart && current < bEnd);
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
    const dates = [];
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
      <div className="relative h-[400px] w-full bg-zinc-900">
        <img src={barber.profilePicture} className="w-full h-full object-cover grayscale brightness-50" alt="" />
        <div className="absolute top-12 left-6 right-6 flex justify-between items-center z-20">
          <button onClick={onBack} className="w-12 h-12 bg-black/80 premium-blur border border-white/10 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all">
            <ArrowLeft size={22} className="text-white" />
          </button>
          <div className="flex gap-2">
             <a href={`tel:+385910000000`} className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl active:scale-90"><Phone size={20} className="text-black" /></a>
             <button className="w-12 h-12 bg-black/80 premium-blur border border-white/10 rounded-full flex items-center justify-center shadow-2xl active:scale-90"><Heart size={22} className="text-zinc-500" /></button>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
      </div>

      <div className="px-6 py-10 space-y-8 -mt-24 relative z-10 bg-black rounded-t-[3.5rem] border-t border-white/5">
        <div className="flex flex-col items-start gap-4">
          <div className="p-3 bg-white/5 border border-white/10 rounded-3xl shadow-2xl"><UserCircle2 size={32} className="text-[#D4AF37]" /></div>
          <div className="flex justify-between items-end w-full">
            <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">{barber.fullName}</h1>
              <div className="flex flex-wrap gap-2">
                <Badge variant="gold"><Star size={10} className="mr-1 fill-current" /> {avgRating}</Badge>
                <Badge variant="neutral"><Scissors size={10} className="mr-1" /> {totalCuts} šišanja</Badge>
              </div>
            </div>
            <div className="bg-[#D4AF37] text-black px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">{barber.workMode}</div>
          </div>
        </div>

        <div className="flex bg-zinc-950 p-1.5 rounded-3xl border border-white/5">
           <button onClick={() => setActiveTab('info')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${activeTab === 'info' ? 'bg-white/10 text-[#D4AF37]' : 'text-zinc-600'}`}>Info</button>
           <button onClick={() => setActiveTab('services')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all ${activeTab === 'services' ? 'bg-white/10 text-[#D4AF37]' : 'text-zinc-600'}`}>Usluge</button>
        </div>

        {activeTab === 'info' ? (
          <div className="space-y-12 animate-lux-fade">
             <section className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-600 font-black uppercase text-[9px] tracking-[0.3em]"><MapPin size={14} className="text-[#D4AF37]" /> LOKACIJA</div>
                <Card className="p-6 bg-zinc-900/40 border-white/5">
                  <p className="text-white font-black text-sm italic mb-4">{barber.address}</p>
                  <div className="w-full h-48 bg-zinc-950 rounded-2xl overflow-hidden relative border border-white/5">
                    <img src="https://images.unsplash.com/photo-1549414574-8555e0546960?q=80&w=600" className="w-full h-full object-cover grayscale opacity-20" alt="Map" />
                    <div className="absolute inset-0 flex items-center justify-center">
                       <Navigation size={24} className="text-[#D4AF37] animate-bounce" />
                    </div>
                  </div>
                </Card>
             </section>
             <section className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-600 font-black uppercase text-[9px] tracking-[0.3em]"><Info size={14} className="text-[#D4AF37]" /> BIO</div>
                <p className="text-zinc-400 leading-relaxed italic text-xs font-bold px-6 py-5 bg-zinc-950 rounded-3xl border border-white/5">{barber.bio}</p>
             </section>
          </div>
        ) : (
          <div className="space-y-4 animate-lux-fade">
            {services.map(s => (
              <Card key={s.id} onClick={() => setSelectedService(s)} className={`p-6 flex gap-6 items-center bg-zinc-950/50 border transition-all rounded-[2.5rem] ${selectedService?.id === s.id ? 'border-[#D4AF37] bg-[#D4AF37]/5 shadow-2xl' : 'border-white/5'}`}>
                <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 shrink-0"><img src={s.imageUrl} className="w-full h-full object-cover grayscale brightness-90" alt={s.name} /></div>
                <div className="flex-1">
                  <h4 className="font-black text-lg uppercase tracking-tighter text-white italic">{s.name}</h4>
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

      {selectedService && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-white/10 p-8 z-[110] rounded-t-[4rem] shadow-2xl animate-slide-up space-y-8 premium-blur">
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {availableDates.map(d => (
              <button key={d.full} onClick={() => setSelectedDate(d.full)} className={`shrink-0 w-20 h-24 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all border ${selectedDate === d.full ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-xl scale-105' : 'bg-zinc-900 border-white/5 text-zinc-600'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{d.dayName}</span>
                <span className="text-2xl font-black italic tracking-tighter">{d.dayNum}</span>
              </button>
            ))}
          </div>
          {selectedDate && (
            <div className="grid grid-cols-4 gap-3">
              {timeSlots.map(slot => (
                <button key={slot.time} disabled={slot.isTaken} onClick={() => setSelectedTime(slot.time)} className={`py-4 rounded-2xl border text-[9px] font-black tracking-widest transition-all ${slot.isTaken ? 'bg-zinc-950/20 text-zinc-900 border-transparent opacity-20 cursor-not-allowed' : selectedTime === slot.time ? 'bg-white text-black border-white shadow-2xl scale-105' : 'bg-zinc-950 text-zinc-600 border-white/5 hover:border-white/20'}`}>
                  {slot.time}
                </button>
              ))}
            </div>
          )}
          <Button disabled={!selectedTime || loading} loading={loading} onClick={handleBook} className="w-full h-20 text-xs font-black uppercase tracking-widest">
            Potvrdi Rezervaciju
          </Button>
        </div>
      )}
    </div>
  );
};

export default BarberProfileDetail;
