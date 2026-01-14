
import { supabase } from './supabase';
import { User, BarberProfile, Service, Booking, Review } from '../types';

/**
 * Production Database Engine
 * Powered by Supabase PostgreSQL.
 * LocalStorage acts only as a high-speed read cache.
 */
export const db = {
  // --- USER PROFILES ---
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
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (!error) {
      // Sync local cache
      const users = db.getUsersSync();
      const idx = users.findIndex(u => u.id === userId);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates } as any;
        localStorage.setItem('trimly_users_cache', JSON.stringify(users));
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
    
    if (!error) {
      const active = db.getActiveUser();
      if (active && active.id === userId) db.setActiveUser({ ...active, role: role as any });
      return true;
    }
    return false;
  },

  setUserBanStatus: async (userId: string, banned: boolean) => {
    const { error } = await supabase.from('profiles').update({ banned }).eq('id', userId);
    return !error;
  },

  deleteAccount: async (userId: string) => {
    const { error: pErr } = await supabase.from('profiles').delete().eq('id', userId);
    const { error: bErr } = await supabase.from('barbers').delete().eq('userId', userId);
    return !pErr && !bErr;
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
    }
    return (data as any) || db.getBarbersSync();
  },

  getBarbersSync: (): BarberProfile[] => {
    const cached = localStorage.getItem('trimly_barbers_cache');
    return cached ? JSON.parse(cached) : [];
  },

  saveBarbers: async (barber: Partial<BarberProfile>) => {
    const payload = { ...barber };
    // Remove complex nested objects if necessary or ensure they are JSONB compatible
    const { error } = await supabase.from('barbers').upsert(payload, { onConflict: 'userId' });
    if (!error) {
      await db.getBarbers(); 
      return true;
    }
    console.error("Save Barber Error:", error);
    return false;
  },

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
      // Logic for service sync: only cache current barber's services if filtered, or all
      const cached = db.getServicesSync();
      const others = cached.filter(s => barberId ? s.barberId !== barberId : false);
      localStorage.setItem('trimly_services_cache', JSON.stringify([...others, ...data]));
    }
    return (data as any) || db.getServicesSync();
  },
  
  getServicesSync: (): Service[] => {
    const cached = localStorage.getItem('trimly_services_cache');
    return cached ? JSON.parse(cached) : [];
  },

  addService: async (service: Service) => {
    const { error } = await supabase.from('services').insert(service);
    return !error;
  },

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
    return (data as any) || db.getBookingsSync();
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

  deleteBooking: async (id: string) => {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    return !error;
  },

  // --- REVIEWS ---
  getReviews: async (barberId?: string): Promise<Review[]> => {
    let query = supabase.from('reviews').select('*');
    if (barberId) query = query.eq('barberId', barberId);
    const { data, error } = await query;
    if (!error && data) localStorage.setItem('trimly_reviews_cache', JSON.stringify(data));
    return (data as any) || db.getReviewsSync();
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
