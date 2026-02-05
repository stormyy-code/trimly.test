
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../store/database';
import { supabase } from '../../store/supabase';
import { Booking, Review, User, BarberProfile } from '../../types';
import { Card, Badge, Button, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Calendar, Clock, Star, RefreshCw, BellRing, Trash2, Loader2, AlertTriangle, X, History, Zap, Users } from 'lucide-react';

interface CustomerBookingsProps {
  user: User;
  lang: Language;
}

const CustomerBookings: React.FC<CustomerBookingsProps> = ({ user, lang }) => {
  const [activeView, setActiveView] = useState<'upcoming' | 'past'>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>(db.getReviewsSync());
  const [barbers, setBarbers] = useState<BarberProfile[]>(db.getBarbersSync());
  const [allBookingsInSystem, setAllBookingsInSystem] = useState<Booking[]>([]);
  const [feedbackBooking, setFeedbackBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const t = translations[lang];

  const fetchBookings = async (force = false) => {
    if (force) setLoading(true);
    try {
      const all = await db.getBookings(user.id, 'customer');
      setBookings(all || []);
      
      const allReviews = await db.getReviews();
      setReviews(allReviews);
      
      const allBarbers = await db.getBarbers();
      setBarbers(allBarbers);

      // Dohvati sve rezervacije u sustavu (samo accepted) da vidimo tko nam je "oteo" termin
      const { data: acceptedAny } = await supabase.from('bookings').select('*').eq('status', 'accepted');
      if (acceptedAny) setAllBookingsInSystem(acceptedAny.map(b => ({
        id: b.id,
        customerId: b.customer_id,
        customerName: b.customer_name,
        customerEmail: b.customer_email,
        barberId: b.barber_id,
        serviceId: b.service_id,
        serviceName: b.service_name,
        date: b.date,
        time: b.time,
        price: b.price,
        status: b.status,
        createdAt: b.created_at
      })));

    } catch (err) {
      console.error("Greška pri dohvaćanju termina:", err);
    } finally {
      if (force) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(true);
    
    const handleReviewsUpdate = () => setReviews(db.getReviewsSync());
    const handleBarbersUpdate = () => setBarbers(db.getBarbersSync());
    
    window.addEventListener('reviews-updated', handleReviewsUpdate);
    window.addEventListener('app-sync-complete', fetchBookings as any);

    const channel = supabase
      .channel(`customer-bookings-realtime-${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookings', 
        filter: `customer_id=eq.${user.id}` 
      }, () => {
        fetchBookings(false);
        setToast({ msg: lang === 'hr' ? 'Status termina je ažuriran!' : 'Appointment status updated!', type: 'success' });
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel);
      window.removeEventListener('reviews-updated', handleReviewsUpdate);
    };
  }, [user.id]);

  const { upcoming, past } = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return {
      upcoming: sorted.filter(b => ['pending', 'accepted'].includes(b.status)),
      past: sorted.filter(b => ['completed', 'rejected', 'cancelled'].includes(b.status))
    };
  }, [bookings]);

  const hasReview = (bookingId: string) => reviews.some(r => r.bookingId === bookingId);

  const handleCancelBooking = async (e: React.MouseEvent, booking: Booking) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmCancelId !== booking.id) {
      setConfirmCancelId(booking.id);
      return;
    }
    setActionLoading(booking.id);
    try {
      const result = await db.updateBookingStatus(booking.id, 'cancelled');
      if (result.success) {
        setToast({ msg: lang === 'hr' ? 'Termin otkazan.' : 'Appointment cancelled.', type: 'success' });
        await fetchBookings(false);
      } else {
        setToast({ msg: `Greška: ${result.error}`, type: 'error' });
      }
    } catch (err: any) {
      setToast({ msg: 'Sistemska greška.', type: 'error' });
    } finally {
      setActionLoading(null);
      setConfirmCancelId(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!feedbackBooking) return;
    setActionLoading(feedbackBooking.id);
    const newReview: Review = {
      id: crypto.randomUUID(),
      bookingId: feedbackBooking.id,
      barberId: feedbackBooking.barberId,
      customerId: user.id,
      customerName: user.fullName || user.email.split('@')[0],
      customerEmail: user.email,
      rating,
      comment,
      createdAt: new Date().toISOString()
    };
    const result = await db.createReview(newReview);
    if (result.success) {
      setToast({ msg: lang === 'hr' ? 'Recenzija objavljena!' : 'Review posted!', type: 'success' });
      setFeedbackBooking(null);
      setComment('');
      await fetchBookings(false);
    } else {
      setToast({ msg: result.error || 'Greška pri slanju.', type: 'error' });
    }
    setActionLoading(null);
  };

  const renderBookingCard = (booking: Booking) => {
    const barber = barbers.find(b => b.id === booking.barberId);
    const reviewed = hasReview(booking.id);
    const isCancelled = booking.status === 'cancelled';
    const isCompleted = booking.status === 'completed';
    const isRejected = booking.status === 'rejected';
    const isConfirming = confirmCancelId === booking.id;

    // Provjeri postoji li netko drugi tko je PRIHVAĆEN za ovaj isti slot
    const takenBySomeoneElse = isRejected && allBookingsInSystem.some(b => 
      b.barberId === booking.barberId && 
      b.date === booking.date && 
      b.time === booking.time && 
      b.customerId !== booking.customerId
    );

    return (
      <Card key={booking.id} className={`p-6 space-y-6 border-white/5 relative overflow-hidden transition-all ${isCancelled || isRejected ? 'opacity-70 grayscale' : ''}`}>
        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shrink-0">
               <img src={barber?.profilePicture} className="w-full h-full object-cover" alt="" />
            </div>
            <div className="py-1">
              <h3 className="font-black text-lg text-white tracking-tight italic uppercase leading-none">{barber?.fullName || 'Barber'}</h3>
              <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mt-2">{booking.serviceName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={isCancelled || isRejected ? 'error' : booking.status === 'accepted' ? 'success' : 'warning'}>
              {isRejected && takenBySomeoneElse ? 'ZAUZEO DRUGI KLIJENT' : booking.status.toUpperCase()}
            </Badge>
            {!isCancelled && !isCompleted && !isRejected && (
              <button 
                onClick={(e) => handleCancelBooking(e, booking)} 
                className={`text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border transition-all ${
                  isConfirming ? 'bg-red-600 text-white' : 'bg-red-500/10 text-red-500 border-red-500/20'
                }`}
              >
                {actionLoading === booking.id ? <Loader2 size={12} className="animate-spin" /> : isConfirming ? 'POTVRDI' : 'OTKAŽI'}
              </button>
            )}
            {isCompleted && !reviewed && (
              <button onClick={() => setFeedbackBooking(booking)} className="text-[8px] font-black uppercase tracking-widest px-3 py-2 bg-[#D4AF37] text-black rounded-lg">OCJENI</button>
            )}
          </div>
        </div>
        
        {takenBySomeoneElse && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
            <Users size={12} className="text-red-500 shrink-0" />
            <p className="text-[7.5px] font-black text-red-500 uppercase tracking-widest leading-relaxed">Nažalost, barber je prihvatio drugog klijenta za ovaj termin. Odaberite novi termin.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5">
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar size={12} className="text-[#C5A059]" />
            <span className="text-[9px] font-black uppercase tracking-widest">{booking.date}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock size={12} className="text-[#C5A059]" />
            <span className="text-[9px] font-black uppercase tracking-widest">{booking.time}h</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Plaćanje u salonu</span>
          <span className="text-xl font-black text-white italic">{booking.price}€</span>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-slide-up pb-32" onClick={() => setConfirmCancelId(null)}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-8 border border-white/10 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">DNEVNIK ŠIŠANJA</p>
          <h2 className="text-3xl font-black text-white tracking-tighter italic">Vaši Termini</h2>
        </div>
        <button onClick={() => fetchBookings(true)} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-white active:rotate-180 transition-all">
          <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="flex bg-zinc-950 p-1.5 rounded-3xl border border-white/5 mx-1">
        <button onClick={() => setActiveView('upcoming')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${activeView === 'upcoming' ? 'bg-white text-black shadow-xl' : 'text-zinc-600'}`}>
           <Zap size={14} /> Aktivni ({upcoming.length})
        </button>
        <button onClick={() => setActiveView('past')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${activeView === 'past' ? 'bg-zinc-900 text-zinc-500' : 'text-zinc-600'}`}>
           <History size={14} /> Povijest ({past.length})
        </button>
      </div>
      <div className="space-y-6 px-1">
        {(activeView === 'upcoming' ? upcoming : past).map(renderBookingCard)}
        {(activeView === 'upcoming' ? upcoming : past).length === 0 && (
          <div className="py-24 text-center opacity-20 italic text-xs">Nema termina.</div>
        )}
      </div>
      {feedbackBooking && (
        <div className="fixed inset-0 z-[500] flex items-end justify-center px-6 pb-12 animate-lux-fade">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setFeedbackBooking(null)}></div>
          <Card className="relative w-full max-w-sm bg-[#0F0F0F] border border-[#C5A059]/30 rounded-[3rem] p-10 space-y-8 shadow-2xl">
            <button onClick={() => setFeedbackBooking(null)} className="absolute top-6 right-8 text-zinc-600"><X size={24} /></button>
            <div className="text-center">
              <h3 className="text-2xl font-black text-white italic uppercase">Ocijeni Šišanje</h3>
              <p className="text-[8px] text-zinc-500 uppercase mt-2">Usluga: {feedbackBooking.serviceName}</p>
            </div>
            <div className="flex justify-center gap-3">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRating(s)} className="active:scale-90 transition-all">
                  <Star size={32} className={s <= rating ? 'text-[#C5A059] fill-[#C5A059]' : 'text-zinc-800'} />
                </button>
              ))}
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Kako ste zadovoljni?" className="w-full bg-black rounded-2xl border border-white/5 p-5 text-xs text-zinc-400 min-h-[100px] outline-none" />
            <Button onClick={handleSubmitReview} loading={!!actionLoading} className="w-full h-16">Spremi ocjenu</Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CustomerBookings;
