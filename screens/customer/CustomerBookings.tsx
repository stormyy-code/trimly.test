
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../store/database';
import { supabase } from '../../store/supabase';
import { Booking, Review, User, BarberProfile } from '../../types';
import { Card, Badge, Button, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Calendar, Clock, Star, RefreshCw, BellRing, Trash2, Loader2, AlertTriangle, X, History, Zap, Users, MessageSquare } from 'lucide-react';

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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const fetchBookings = async (force = false) => {
    if (force) setLoading(true);
    try {
      const all = await db.getBookings(user.id, 'customer');
      setBookings(all || []);
      const allReviews = await db.getReviews();
      setReviews(allReviews);
      const allBarbers = await db.getBarbers();
      setBarbers(allBarbers);
      const { data: acceptedAny } = await supabase.from('bookings').select('*').eq('status', 'accepted');
      if (acceptedAny) setAllBookingsInSystem(acceptedAny.map(b => ({
        id: b.id, customerId: b.customer_id, customerName: b.customer_name, customerEmail: b.customer_email,
        barberId: b.barber_id, serviceId: b.service_id, serviceName: b.service_name,
        date: b.date, time: b.time, price: b.price, status: b.status, createdAt: b.created_at
      })));
    } catch (err) {
      console.error("Fetch error:", err);
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
    const channel = supabase.channel(`customer-bookings-realtime-${user.id}`).on('postgres_changes', { 
      event: '*', schema: 'public', table: 'bookings', filter: `customer_id=eq.${user.id}` 
    }, () => {
      fetchBookings(false);
      setToast({ msg: lang === 'hr' ? 'Status termina ažuriran!' : 'Status updated!', type: 'success' });
    }).subscribe();
    return () => { 
      supabase.removeChannel(channel);
      window.removeEventListener('reviews-updated', handleReviewsUpdate);
    };
  }, [user.id]);

  const { upcoming, past } = useMemo(() => {
    const chronoSort = (a: Booking, b: Booking) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    };

    return {
      upcoming: bookings.filter(b => ['pending', 'accepted'].includes(b.status)).sort(chronoSort),
      past: bookings.filter(b => ['completed', 'rejected', 'cancelled'].includes(b.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    };
  }, [bookings]);

  const handleCancelBooking = async (e: React.MouseEvent, booking: Booking) => {
    e.preventDefault(); e.stopPropagation();
    
    // 6-hour rule check
    const now = new Date();
    const bDate = new Date(`${booking.date}T${booking.time}`);
    const diffHours = (bDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 6) {
      setToast({ 
        msg: lang === 'hr' ? 'Otkazivanje nije moguće manje od 6h prije termina.' : 'Cannot cancel less than 6h before.', 
        type: 'error' 
      });
      return;
    }

    if (confirmCancelId !== booking.id) {
      setConfirmCancelId(booking.id);
      return;
    }
    setActionLoading(booking.id);
    const result = await db.updateBookingStatus(booking.id, 'cancelled');
    if (result.success) {
      setToast({ msg: lang === 'hr' ? 'Termin otkazan.' : 'Cancelled.', type: 'success' });
      await fetchBookings(false);
    }
    setActionLoading(null);
    setConfirmCancelId(null);
  };

  const submitReview = async () => {
    if (!feedbackBooking) return;
    setActionLoading('review');
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
      setToast({ msg: lang === 'hr' ? 'Hvala na recenziji!' : 'Thanks for the review!', type: 'success' });
      setFeedbackBooking(null);
      setComment('');
      setRating(5);
      fetchBookings(false);
    }
    setActionLoading(null);
  };

  const renderBookingCard = (booking: Booking) => {
    const barber = barbers.find(b => b.id === booking.barberId);
    const reviewed = reviews.some(r => r.bookingId === booking.id);
    const isCancelled = booking.status === 'cancelled';
    const isCompleted = booking.status === 'completed';
    const isRejected = booking.status === 'rejected';
    const isConfirming = confirmCancelId === booking.id;
    const takenBySomeoneElse = isRejected && allBookingsInSystem.some(b => 
      b.barberId === booking.barberId && b.date === booking.date && b.time === booking.time && b.customerId !== booking.customerId
    );

    return (
      <Card key={booking.id} className={`p-4 space-y-4 border-white/5 relative overflow-hidden transition-all text-left flex flex-col items-start ${isCancelled || isRejected ? 'opacity-70 grayscale' : ''}`}>
        <div className="flex justify-between items-start w-full gap-3">
          <div className="flex gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 shrink-0">
               <img src={barber?.profilePicture} className="w-full h-full object-cover" alt="" />
            </div>
            <div className="py-0.5 min-w-0 flex-1">
              <h3 className="font-black text-base text-white tracking-tight italic uppercase leading-tight truncate">{barber?.fullName || 'Barber'}</h3>
              <p className="text-[7.5px] text-zinc-500 font-black uppercase tracking-widest mt-1.5 truncate">{booking.serviceName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant={isCancelled || isRejected ? 'error' : booking.status === 'accepted' ? 'success' : 'warning'} className="text-[7px]">
              {isRejected && takenBySomeoneElse ? 'ZAUZETO' : booking.status.toUpperCase()}
            </Badge>
            {!isCancelled && !isCompleted && !isRejected && (
              <button 
                onClick={(e) => handleCancelBooking(e, booking)} 
                className={`text-[7px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border transition-all ${
                  isConfirming ? 'bg-red-600 text-white' : 'bg-red-500/10 text-red-500 border-red-500/20'
                }`}
              >
                {actionLoading === booking.id ? <Loader2 size={10} className="animate-spin" /> : isConfirming ? 'POTVRDI' : 'OTKAŽI'}
              </button>
            )}
            {isCompleted && !reviewed && (
              <button onClick={() => setFeedbackBooking(booking)} className="text-[7px] font-black uppercase tracking-widest px-2.5 py-1.5 bg-[#D4AF37] text-black rounded-lg">OCJENI</button>
            )}
          </div>
        </div>
        
        {takenBySomeoneElse && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 w-full">
            <Users size={10} className="text-red-500 shrink-0" />
            <p className="text-[7px] font-black text-red-500 uppercase tracking-widest leading-relaxed">Nažalost, barber je prihvatio drugog klijenta.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 py-3 border-y border-white/5 w-full">
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar size={10} className="text-[#C5A059]" />
            <span className="text-[8px] font-black uppercase tracking-widest">{formatDate(booking.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400 border-l border-white/5 pl-3">
            <Clock size={10} className="text-[#C5A059]" />
            <span className="text-[8px] font-black uppercase tracking-widest">{booking.time}h</span>
          </div>
        </div>
        <div className="flex justify-between items-center w-full">
          <span className="text-[7.5px] font-black uppercase tracking-widest text-zinc-600">Plaćanje u salonu</span>
          <span className="text-xl font-black text-white italic leading-none">{booking.price}€</span>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-slide-up pb-32 w-full px-1" onClick={() => setConfirmCancelId(null)}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-6 border border-white/10 flex items-center justify-between">
        <div className="text-left">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">DNEVNIK ŠIŠANJA</p>
          <h2 className="text-2xl font-black text-white tracking-tighter italic">Vaši Termini</h2>
        </div>
        <button onClick={() => fetchBookings(true)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white active:rotate-180 transition-all">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-center gap-3">
         <AlertTriangle className="text-amber-500 shrink-0" size={14} />
         <p className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Napomena: Otkazivanje nije moguće manje od 6h prije početka termina.</p>
      </div>

      <div className="flex bg-zinc-950 p-1.5 rounded-3xl border border-white/5">
        <button onClick={() => setActiveView('upcoming')} className={`flex-1 py-3.5 text-[8px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${activeView === 'upcoming' ? 'bg-white text-black shadow-xl' : 'text-zinc-600'}`}>
           <Zap size={12} /> Aktivni ({upcoming.length})
        </button>
        <button onClick={() => setActiveView('past')} className={`flex-1 py-3.5 text-[8px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${activeView === 'past' ? 'bg-zinc-900 text-zinc-500' : 'text-zinc-600'}`}>
           <History size={12} /> Povijest ({past.length})
        </button>
      </div>
      <div className="space-y-4">
        {(activeView === 'upcoming' ? upcoming : past).map(renderBookingCard)}
        {(activeView === 'upcoming' ? upcoming : past).length === 0 && (
          <div className="py-24 text-center opacity-20 italic text-[9px] font-black uppercase tracking-widest">Nema zabilježenih termina.</div>
        )}
      </div>

      {feedbackBooking && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center px-6 animate-lux-fade" onClick={() => setFeedbackBooking(null)}>
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl"></div>
          <Card className="relative w-full max-w-sm bg-zinc-950 border border-[#D4AF37]/30 rounded-[3rem] p-8 space-y-6 flex flex-col items-center text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <MessageSquare size={36} className="text-[#D4AF37]" />
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Kako je bilo?</h3>
              <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">Ocijeni uslugu kod: {feedbackBooking.customerName}</p>
            </div>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRating(s)} className="active:scale-90 transition-all">
                  <Star size={28} className={s <= rating ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-zinc-800'} />
                </button>
              ))}
            </div>
            <textarea 
              value={comment} 
              onChange={e => setComment(e.target.value)} 
              placeholder="Napiši komentar..." 
              className="w-full bg-black border border-white/5 rounded-2xl p-4 text-xs text-white outline-none min-h-[100px] focus:border-[#D4AF37]/40"
            />
            <Button onClick={submitReview} loading={actionLoading === 'review'} className="w-full">Spremi recenziju</Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CustomerBookings;
