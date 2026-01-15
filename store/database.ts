// Fix: Added missing methods and synchronized caching behavior in database.ts
import { supabase } from './supabase';
import { User, BarberProfile, Service, Booking, Review } from '../types';

export const db = {
  // --- USERS & PROFILES ---
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) return db.getUsersSync();
    localStorage.setItem('trimly_users_cache', JSON.stringify(data));
    return (data as any) || [];
  },

  getUsersSync: (): User[] => {
    const cached = localStorage.getItem('trimly_users_cache');
    return cached ? JSON.parse(cached) : [];
  },

  updateProfileDetails: async (userId: string, updates: { full_name?: string, avatar_url?: string }) => {
    // Supabase profiles tablica obično koristi snake_case (full_name, avatar_url)
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (!error) {
      const active = db.getActiveUser();
      if (active) {
        db.setActiveUser({
          ...active,
          fullName: updates.full_name || active.fullName,
          avatarUrl: updates.avatar_url || active.avatarUrl
        });
      }
      return true;
    }
    return false;
  },

  updateProfileRole: async (userId: string, role: string) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').upsert({ 
      id: userId, 
      role: role.toLowerCase().trim(),
      email: authUser?.email || ''
    }, { onConflict: 'id' });
    return !error;
  },

  // Fix: Added missing setUserBanStatus method used by AdminBarbers
  setUserBanStatus: async (userId: string, banned: boolean) => {
    const { error } = await supabase.from('profiles').update({ banned }).eq('id', userId);
    return !error;
  },

  // Fix: Added missing deleteAccount method used by CustomerProfile
  deleteAccount: async (userId: string) => {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.from('barbers').delete().eq('userId', userId);
    return true;
  },

  getActiveUser: (): User | null => {
    const cached = localStorage.getItem('trimly_active_user');
    return cached ? JSON.parse(cached) : null;
  },

  setActiveUser: (user: User | null) => {
    if (user) localStorage.setItem('trimly_active_user', JSON.stringify(user));
    else localStorage.removeItem('trimly_active_user');
  },

  // --- BARBER PROFILES ---
  getBarbers: async (): Promise<BarberProfile[]> => {
    const { data, error } = await supabase.from('barbers').select('*').order('createdAt', { ascending: false });
    if (!error && data) {
      localStorage.setItem('trimly_barbers_cache', JSON.stringify(data));
      window.dispatchEvent(new Event('app-sync-complete'));
      return data as BarberProfile[];
    }
    return db.getBarbersSync();
  },

  getBarbersSync: (): BarberProfile[] => {
    const cached = localStorage.getItem('trimly_barbers_cache');
    return cached ? JSON.parse(cached) : [];
  },

  saveBarbers: async (barber: Partial<BarberProfile>) => {
    try {
      const { error } = await supabase.from('barbers').upsert(barber, { onConflict: 'userId' });
      if (error) throw error;
      await db.getBarbers(); 
      return { success: true };
    } catch (err: any) {
      console.error("DB Save Barber Error:", err.message);
      return { success: false, error: err.message };
    }
  },

  // Fix: Added missing approveBarber method used by AdminApprovals
  approveBarber: async (barberId: string) => {
    const { error } = await supabase.from('barbers').update({ approved: true }).eq('id', barberId);
    if (!error) await db.getBarbers();
    return !error;
  },

  // --- SERVICES ---
  getServices: async (barberId?: string): Promise<Service[]> => {
    let query = supabase.from('services').select('*');
    if (barberId) query = query.eq('barberId', barberId);
    const { data, error } = await query;
    if (!error && data) {
      localStorage.setItem('trimly_services_cache', JSON.stringify(data));
    }
    if (error) return db.getServicesSync();
    return (data as any) || [];
  },

  // Fix: Added missing getServicesSync method used by CustomerHome and BarberProfileDetail
  getServicesSync: (): Service[] => {
    const cached = localStorage.getItem('trimly_services_cache');
    return cached ? JSON.parse(cached) : [];
  },

  addService: async (service: Service) => {
    const { error } = await supabase.from('services').insert(service);
    return !error;
  },

  // Fix: Added missing deleteService method used by BarberServices
  deleteService: async (id: string) => {
    const { error } = await supabase.from('services').delete().eq('id', id);
    return !error;
  },

  // --- BOOKINGS ---
  getBookings: async (userId?: string, role?: string): Promise<Booking[]> => {
    let query = supabase.from('bookings').select('*');
    if (userId && role) {
      const column = role === 'customer' ? 'customerId' : 'barberId';
      query = query.eq(column, userId);
    }
    const { data, error } = await query.order('createdAt', { ascending: false });
    if (!error && data) {
      localStorage.setItem('trimly_bookings_cache', JSON.stringify(data));
      window.dispatchEvent(new Event('app-sync-complete'));
    }
    if (error) return db.getBookingsSync();
    return (data as any) || [];
  },

  getBookingsSync: (): Booking[] => {
    const cached = localStorage.getItem('trimly_bookings_cache');
    return cached ? JSON.parse(cached) : [];
  },

  createBooking: async (booking: any) => {
    const { error } = await supabase.from('bookings').insert(booking);
    return !error;
  },

  updateBookingStatus: async (bookingId: string, status: string) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId);
    return !error;
  },

  // Fix: Added missing deleteBooking method used by CustomerBookings
  deleteBooking: async (id: string) => {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    return !error;
  },

  // --- REVIEWS ---
  getReviews: async (barberId?: string): Promise<Review[]> => {
    let query = supabase.from('reviews').select('*');
    if (barberId) query = query.eq('barberId', barberId);
    const { data, error } = await query;
    if (!error && data) {
      localStorage.setItem('trimly_reviews_cache', JSON.stringify(data));
    }
    if (error) return db.getReviewsSync();
    return (data as any) || [];
  },

  getReviewsSync: (): Review[] => {
    const cached = localStorage.getItem('trimly_reviews_cache');
    return cached ? JSON.parse(cached) : [];
  },

  createReview: async (review: Review) => {
    const { error } = await supabase.from('reviews').insert(review);
    return !error;
  }
};