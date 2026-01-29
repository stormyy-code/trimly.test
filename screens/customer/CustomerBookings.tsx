
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../store/database';
import { supabase } from '../../store/supabase';
import { Booking, Review, User } from '../../types';
import { Card, Badge, Button, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Calendar, Clock, Star, RefreshCw, BellRing, Trash2, Loader2, AlertTriangle, X, History, Zap } from 'lucide-react';

interface CustomerBookingsProps {
  user: User;
  lang: Language;
}

const CustomerBookings: React.FC<CustomerBookingsProps> = ({ user, lang }) => {
  const [activeView, setActiveView] = useState<'upcoming' | 'past'>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>(db.getReviewsSync());
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
    } catch (err) {
      console.error("Greška pri dohvaćanju termina:", err);
    } finally {
      if (force) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(true);
    
    const handleReviewsUpdate = () => setReviews(db.getReviewsSync());
    window.addEventListener('reviews-updated', handleReviewsUpdate);
    window.addEventListener('user-profile-updated', () => fetchBookings(false));

    const channel = supabase
      .channel(`customer-bookings-realtime-${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookings', 
        filter: `customer_id=eq.${user.id}` 
      }, () => {
        fetchBookings(false);
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

  const isCancelable = (date: string, time: string) => {
    try {
      // Normalizacija formata vremena HH:mm
      const normalizedTime = time.length === 5 ? time : time.padStart(5, '0');
      const appointmentDate = new Date(`${date}T${normalizedTime}:00`);
      const now = new Date();
      
      // Razlika u satima
      const diffInMs = appointmentDate.getTime() - now.getTime();
      const diffInHours = diffInMs / (1000 * 60 * 60);
      
      return diffInHours >= 6;
    } catch (e) { 
      return false; 
    }
  };

  const handleCancelBooking = async (e: React.MouseEvent, booking: Booking) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isCancelable(booking.date, booking.time)) {
      setToast({ 
        msg: lang === 'hr' ? 'Otkazivanje nije moguće manje od 6h prije termina.' : 'Cancellation not allowed less than 6h before.', 
        type: 'error' 
      });
      setConfirmCancelId(null);
      return;
    }

    if (confirmCancelId !== booking.id) {
      setConfirmCancelId(booking.id);
      return;
    }

    setActionLoading(booking.id);
    try {
      const result = await db.updateBookingStatus(booking.id, 'cancelled');
      
      if (result.success) {
        setToast({ msg: lang === 'hr' ? 'Termin uspješno otkazan.' : 'Appointment cancelled.', type: 'success' });
        // Prisilni refresh liste i micanje iz UI-a
        setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'cancelled' } : b));
        await fetchBookings(false);
      } else {
        // Prikazujemo točnu grešku (vjerojatno SQL RLS problem)
        setToast({ msg: `Greška: ${result.error}`, type: 'error' });
      }
    } catch (err: any) {
      setToast({ msg: 'Sistemska greška pri otkazivanju.', type: 'error' });
    } finally {
      setActionLoading(null);
      setConfirmCancelId(null);
    }
  };

  const renderBookingCard = (booking: Booking) => {
    const barber = db.getBarbersSync().find(b => b.id === booking.barberId);
    const reviewed = hasReview(booking.id);
    const isCancelled = booking.status === 'cancelled';
    const isAccepted = booking.status === 'accepted';
    const isCompleted = booking.status === 'completed';
    const isConfirming = confirmCancelId === booking.id;
    const canCancel = isCancelable(booking.date, booking.time) && !['completed', 'rejected', 'cancelled'].includes(booking.status);

    return (
      <Card key={booking.id} className={`p-6 space-y-6 border-white/5 relative overflow-hidden transition-all ${isCancelled ? 'opacity-50 grayscale border-red-500/10' : ''}`}>
        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            <img src={barber?.profilePicture} className="w-14 h-14 rounded-2xl object-cover border border-white/10" alt="" />
            <div className="py-1">
              <h3 className="font-black text-lg text-white tracking-tight italic uppercase leading-none">{barber?.fullName || 'Barber'}</h3>
              <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mt-2">{booking.serviceName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={isCancelled ? 'error' : isAccepted ? 'success' : booking.status === 'pending' ? 'warning' : 'neutral'}>
              {isCancelled ? (lang === 'hr' ? 'OTKAZANO' : 'CANCELLED') : booking.status.toUpperCase()}
            </Badge>
            {upcoming.some(b => b.id === booking.id) && !isCancelled && (
              <button 
                onClick={(e) => handleCancelBooking(e, booking)} 
                disabled={actionLoading === booking.id}
                className={`text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border transition-all flex items-center justify-center min-w-[85px] h-9 ${
                  isConfirming ? 'bg-red-600 text-white border-red-400 animate-pulse' : 'bg-red-500/10 text-red-500 border-red-500/20 active:scale-95'
                } ${!canCancel && !isConfirming ? 'opacity-20 cursor-not-allowed grayscale pointer-events-none' : ''}`}
              >
                {actionLoading === booking.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isConfirming ? (
                  lang === 'hr' ? 'POTVRDI' : 'CONFIRM'
                ) : (
                  lang === 'hr' ? 'OTKAŽI' : 'CANCEL'
                )}
              </button>
            )}
            {isCompleted && !reviewed && (
              <button onClick={() => setFeedbackBooking(booking)} className="text-[8px] font-black uppercase tracking-widest px-3 py-2 bg-[#D4AF37] text-black rounded-lg h-9">OCJENI</button>
            )}
          </div>
        </div>
        
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
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
            {isCancelled ? (lang === 'hr' ? 'Ovaj termin je otkazan' : 'Appointment cancelled') : (lang === 'hr' ? 'Plaćanje u salonu' : 'Pay at shop')}
          </span>
          <span className="text-xl font-black text-white italic">{booking.price}€</span>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-slide-up pb-32" onClick={() => setConfirmCancelId(null)}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-8 border border-white/10 ios-shadow flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">{lang === 'hr' ? 'DNEVNIK ŠIŠANJA' : 'HAIRCUT LOG'}</p>
          <h2 className="text-3xl font-black text-white tracking-tighter italic">{lang === 'hr' ? 'Vaši Termini' : 'Your Visits'}</h2>
        </div>
        <button onClick={() => fetchBookings(true)} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-white active:rotate-180 transition-all">
          <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex bg-zinc-950 p-1.5 rounded-3xl border border-white/5 mx-1">
        <button onClick={() => setActiveView('upcoming')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${activeView === 'upcoming' ? 'bg-white text-black shadow-xl' : 'text-zinc-600'}`}>
           <Zap size={14} /> {lang === 'hr' ? 'Aktivni' : 'Active'} ({upcoming.length})
        </button>
        <button onClick={() => setActiveView('past')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${activeView === 'past' ? 'bg-zinc-900 text-zinc-500' : 'text-zinc-600'}`}>
           <History size={14} /> {lang === 'hr' ? 'Povijest' : 'History'} ({past.length})
        </button>
      </div>

      <div className="space-y-6 px-1">
        {activeView === 'upcoming' ? (
          upcoming.length === 0 ? (
            <div className="py-24 text-center opacity-20 italic text-xs">
              {lang === 'hr' ? 'Nema aktivnih termina.' : 'No active appointments.'}
            </div>
          ) : upcoming.map(renderBookingCard)
        ) : (
          past.length === 0 ? (
            <div className="py-24 text-center opacity-20 italic text-xs">
              {lang === 'hr' ? 'Povijest je prazna.' : 'History is empty.'}
            </div>
          ) : past.map(renderBookingCard)
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
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder={lang === 'hr' ? 'Kako ste zadovoljni?' : 'How was your experience?'} className="w-full bg-black rounded-2xl border border-white/5 p-5 text-xs text-zinc-400 min-h-[100px] outline-none" />
            <Button onClick={() => {}} loading={!!actionLoading} className="w-full h-16">Spremi ocjenu</Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CustomerBookings;
