
import { supabase } from './supabase';
import { User, BarberProfile, Service, Booking, Review } from '../types';

export const db = {
  // --- USERS & PROFILES ---
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) console.error("Error fetching users:", error);
    return (data as any) || [];
  },

  saveUsers: async (users: User[]) => {
    const { error } = await supabase.from('profiles').upsert(users);
    return !error;
  },

  // --- AUTH SESSION HELPERS ---
  /**
   * Retrieves the currently active user from local storage.
   * Fix for errors in Layout, Login, and Register screens.
   */
  getActiveUser: (): User | null => {
    const cached = localStorage.getItem('bb_active_user');
    return cached ? JSON.parse(cached) : null;
  },

  /**
   * Persists or clears the active user session in local storage.
   * Fix for errors in Layout, Login, and Register screens.
   */
  setActiveUser: (user: User | null) => {
    if (user) {
      localStorage.setItem('bb_active_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('bb_active_user');
    }
  },

  // --- BARBERS ---
  getBarbers: async (): Promise<BarberProfile[]> => {
    const { data, error } = await supabase
      .from('barbers')
      .select('*')
      .order('createdAt', { ascending: false });
    
    if (error) {
      console.error("Error fetching barbers:", error);
      return [];
    }
    
    if (data) {
      localStorage.setItem('bb_barbers_cache', JSON.stringify(data));
      window.dispatchEvent(new Event('app-sync-start'));
    }
    return (data as any) || [];
  },

  getBarbersSync: (): BarberProfile[] => {
    const cached = localStorage.getItem('bb_barbers_cache');
    return cached ? JSON.parse(cached) : [];
  },

  saveBarbers: async (barber: Partial<BarberProfile> | Partial<BarberProfile>[]) => {
    const { error } = await supabase
      .from('barbers')
      .upsert(barber, { onConflict: 'userId' });
      
    if (error) {
      console.error("Supabase Barber Save Error:", error);
      return false;
    }

    await db.getBarbers(); 
    return true;
  },

  // --- SERVICES ---
  getServices: async (barberId?: string): Promise<Service[]> => {
    let query = supabase.from('services').select('*');
    if (barberId) query = query.eq('barberId', barberId);
    const { data, error } = await query;
    if (error) console.error("Error fetching services:", error);
    
    if (data) {
        localStorage.setItem('bb_services_cache', JSON.stringify(data));
    }
    return (data as any) || [];
  },
  
  getServicesSync: (): Service[] => {
    const cached = localStorage.getItem('bb_services_cache');
    return cached ? JSON.parse(cached) : [];
  },

  saveServices: async (services: Service[]) => {
    const { error } = await supabase.from('services').upsert(services);
    if (!error) await db.getServices();
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
    if (error) console.error("Error fetching bookings:", error);
    
    if (data) {
      localStorage.setItem('bb_bookings_cache', JSON.stringify(data));
      window.dispatchEvent(new Event('app-sync-start'));
    }
    return (data as any) || [];
  },

  getBookingsSync: (): Booking[] => {
    const cached = localStorage.getItem('bb_bookings_cache');
    return cached ? JSON.parse(cached) : [];
  },

  saveBookings: async (bookings: Booking[]) => {
    const { error } = await supabase.from('bookings').upsert(bookings);
    return !error;
  },

  createBooking: async (booking: any) => {
    const { error } = await supabase.from('bookings').insert(booking);
    if (!error) await db.getBookings();
    return !error;
  },

  // --- REVIEWS ---
  getReviews: async (barberId?: string): Promise<Review[]> => {
    let query = supabase.from('reviews').select('*');
    if (barberId) query = query.eq('barberId', barberId);
    const { data, error } = await query;
    if (error) console.error("Error fetching reviews:", error);
    
    if (data) {
      localStorage.setItem('bb_reviews_cache', JSON.stringify(data));
    }
    return (data as any) || [];
  },

  getReviewsSync: (): Review[] => {
    const cached = localStorage.getItem('bb_reviews_cache');
    return cached ? JSON.parse(cached) : [];
  },

  saveReviews: async (reviews: Review[]) => {
    const { error } = await supabase.from('reviews').upsert(reviews);
    if (!error) await db.getReviews();
    return !error;
  }
};
