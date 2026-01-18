
import React, { useState, useEffect } from 'react';
import { db } from '../../store/database';
import { supabase } from '../../store/supabase';
import { Booking, Review, User } from '../../types';
import { Card, Badge, Button, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Calendar, Clock, Star, RefreshCw, BellRing, Trash2, Loader2, AlertTriangle, X } from 'lucide-react';

interface CustomerBookingsProps {
  user: User;
  lang: Language;
}

const CustomerBookings: React.FC<CustomerBookingsProps> = ({ user, lang }) => {
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
      setBookings((all || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error("Fetch bookings error:", err);
    } finally {
      if (force) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(true);
    
    const handleReviewsUpdate = () => {
      setReviews(db.getReviewsSync());
    };

    window.addEventListener('reviews-updated', handleReviewsUpdate);
    window.addEventListener('user-profile-updated', () => fetchBookings(false));

    const channel = supabase
      .channel(`customer-bookings-${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookings', 
        filter: `customer_id=eq.${user.id}` 
      }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel);
      window.removeEventListener('reviews-updated', handleReviewsUpdate);
    };
  }, [user.id]);

  const hasReview = (bookingId: string) => reviews.some(r => r.bookingId === bookingId);
  const pendingReviewBookings = bookings.filter(b => b.status === 'completed' && !hasReview(b.id));

  const handleCancelBooking = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirmCancelId !== id) {
      setConfirmCancelId(id);
      return;
    }

    setActionLoading(id);
    try {
      const result = await db.updateBookingStatus(id, 'cancelled');
      if (result.success) {
        setToast({ msg: lang === 'hr' ? 'Termin otkazan.' : 'Booking cancelled.', type: 'success' });
        fetchBookings();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setToast({ msg: `Greška: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
      setConfirmCancelId(null);
    }
  };

  const generateSafeId = () => crypto.randomUUID();

  const handleSubmitFeedback = async () => {
    if (!feedbackBooking || actionLoading) return;
    
    setActionLoading(feedbackBooking.id);
    try {
      const newReview: Review = {
        id: generateSafeId(),
        bookingId: feedbackBooking.id,
        barberId: feedbackBooking.barberId,
        customerId: user.id,
        customerName: user.fullName || user.email.split('@')[0],
        customerEmail: user.email,
        rating,
        comment: comment.trim(),
        createdAt: new Date().toISOString()
      };

      const result = await db.createReview(newReview);
      
      if (result.success) {
        setToast({ msg: lang === 'hr' ? 'Hvala na ocjeni!' : 'Thank you for rating!', type: 'success' });
        setFeedbackBooking(null);
        setComment('');
        setRating(5);
        // Instant refresh lokalne liste
        setReviews(prev => [...prev, newReview]);
      } else {
        setToast({ msg: `Greška baze: ${result.error}`, type: 'error' });
      }
    } catch (err: any) {
      setToast({ msg: `Sistemska greška: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'accepted': return 'success';
      case 'rejected': return 'error';
      case 'cancelled': return 'neutral';
      case 'completed': return 'neutral';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-8 animate-slide-up relative pb-20" onClick={() => setConfirmCancelId(null)}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="premium-blur bg-white/5 rounded-[2rem] p-8 border border-white/10 ios-shadow flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">{lang === 'hr' ? 'Dnevnik termina' : 'Appointment Log'}</p>
          <h2 className="text-3xl font-black text-white tracking-tighter italic">{lang === 'hr' ? 'Vaši posjeti' : 'Your Visits'}</h2>
        </div>
        <button onClick={() => fetchBookings(true)} className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white active:rotate-180 transition-all">
          <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {pendingReviewBookings.length > 0 && (
        <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-[2rem] p-6 flex items-center gap-5 animate-pulse mx-1">
          <div className="w-12 h-12 bg-[#D4AF37] rounded-2xl flex items-center justify-center text-black shadow-xl"><Star size={24} className="fill-current" /></div>
          <div className="flex-1">
            <h4 className="text-[#D4AF37] font-black text-[10px] uppercase tracking-widest leading-none mb-1">Ocjena na čekanju</h4>
            <p className="text-white text-[11px] font-bold italic tracking-tight">Ocijenite svoje iskustvo!</p>
          </div>
          <button onClick={() => setFeedbackBooking(pendingReviewBookings[0])} className="h-10 px-4 bg-[#D4AF37] text-black font-black rounded-xl text-[8px] uppercase tracking-widest">Ocijeni</button>
        </div>
      )}

      {loading && bookings.length === 0 ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#D4AF37]" size={32} /></div>
      ) : bookings.length === 0 ? (
        <div className="py-32 text-center opacity-30 px-10">
          <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-[11px]">Nema zabilježenih aktivnosti</p>
        </div>
      ) : (
        <div className="space-y-6 px-1">
          {bookings.map(booking => {
            const barber = db.getBarbersSync().find(b => b.id === booking.barberId);
            const reviewed = hasReview(booking.id);
            const isAccepted = booking.status === 'accepted';
            const isPending = booking.status === 'pending';
            const isCancelled = booking.status === 'cancelled';
            const isCompleted = booking.status === 'completed';
            const isConfirming = confirmCancelId === booking.id;
            const isThisActionLoading = actionLoading === booking.id;

            return (
              <Card key={booking.id} className={`p-6 space-y-6 group border-white/5 transition-all relative overflow-hidden ${isAccepted ? 'border-emerald-500/30 bg-emerald-500/5 shadow-2xl' : isCompleted && !reviewed ? 'border-[#D4AF37]/30 bg-[#D4AF37]/5' : ''} ${isThisActionLoading ? 'opacity-40 grayscale pointer-events-none' : ''} ${isCancelled ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <img src={barber?.profilePicture} className="w-14 h-14 rounded-2xl object-cover border border-white/10" alt="" />
                    <div className="py-1">
                      <h3 className="font-black text-lg text-white tracking-tight italic uppercase leading-none">
                        {db.getUserNameById(barber?.userId || '', barber?.fullName || 'Barber')}
                      </h3>
                      <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mt-2">{booking.serviceName}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={getStatusVariant(booking.status) as any}>
                      {isCancelled ? (lang === 'hr' ? 'OTKAZANO' : 'CANCELLED') : booking.status}
                    </Badge>
                    {(isPending || isAccepted) && (
                       <button 
                         onClick={(e) => handleCancelBooking(e, booking.id)} 
                         disabled={!!actionLoading} 
                         className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 p-3 active:scale-95 rounded-xl border transition-all ${
                           isConfirming 
                           ? 'bg-red-600 text-white border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.4)] animate-pulse' 
                           : 'bg-red-500/10 text-red-500 border-red-500/20'
                         }`}
                       >
                         {isThisActionLoading ? (
                           <Loader2 size={12} className="animate-spin" />
                         ) : isConfirming ? (
                           <><AlertTriangle size={12} /> {lang === 'hr' ? 'POTVRDI' : 'SURE?'}</>
                         ) : (
                           <><Trash2 size={12} /> {lang === 'hr' ? 'OTKAŽI' : 'CANCEL'}</>
                         )}
                       </button>
                    )}
                    {isCompleted && !reviewed && (
                      <button 
                        onClick={() => setFeedbackBooking(booking)}
                        className="text-[8px] font-black uppercase tracking-widest px-3 py-2 bg-[#D4AF37] text-black rounded-lg mt-2"
                      >
                        Ocijeni
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 py-5 border-y border-white/5">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Calendar size={12} className="text-[#C5A059]" />
                    <span className="text-[9px] font-black uppercase tracking-widest">{booking.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Clock size={12} className="text-[#C5A059]" />
                    <span className="text-[9px] font-black uppercase tracking-widest">{booking.time}h</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                   <div className="flex items-center gap-3">
                     <span className={`block w-2.5 h-2.5 rounded-full ${isAccepted ? 'bg-emerald-500 animate-pulse' : isPending ? 'bg-amber-500' : isCancelled ? 'bg-red-900' : 'bg-zinc-700'}`}></span>
                     <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                       {isPending ? 'Čeka odobrenje' : isAccepted ? 'Spremni za šišanje' : isCancelled ? (lang === 'hr' ? 'Vi ste otkazali' : 'You cancelled') : 'Povijest'}
                     </span>
                  </div>
                  <span className="text-xl font-black text-white italic">{booking.price}€</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackBooking && (
        <div className="fixed inset-0 z-[500] flex items-end justify-center px-6 pb-12 animate-lux-fade">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => !actionLoading && setFeedbackBooking(null)}></div>
          <Card className="relative w-full max-w-sm bg-[#0F0F0F] border border-[#C5A059]/30 rounded-[3rem] p-10 space-y-10 shadow-[0_50px_100px_rgba(0,0,0,1)]">
            <button 
              disabled={!!actionLoading} 
              onClick={() => setFeedbackBooking(null)} 
              className="absolute top-6 right-8 text-zinc-600 active:scale-90 transition-all"
            >
              <X size={24} />
            </button>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Ocjena šišanja</h3>
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Podijelite svoje iskustvo</p>
            </div>

            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  disabled={!!actionLoading}
                  onClick={() => setRating(star)} 
                  className="transition-all active:scale-90"
                >
                  <Star size={32} className={`transition-all ${star <= rating ? 'text-[#C5A059] fill-[#C5A059]' : 'text-zinc-800'}`} />
                </button>
              ))}
            </div>
            
            <textarea 
              value={comment} 
              disabled={!!actionLoading}
              onChange={(e) => setComment(e.target.value)} 
              placeholder="Kako ste zadovoljni šišanjem?" 
              className="w-full bg-black rounded-2xl border border-white/5 p-5 text-xs text-zinc-400 min-h-[120px] outline-none focus:border-[#C5A059]/40 transition-all disabled:opacity-50" 
            />
            
            <div className="flex flex-col gap-3">
               <Button 
                 onClick={handleSubmitFeedback} 
                 disabled={!!actionLoading}
                 className="w-full h-18 text-xs font-black uppercase tracking-widest" 
                 loading={!!actionLoading}
               >
                 Spremi ocjenu
               </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CustomerBookings;
