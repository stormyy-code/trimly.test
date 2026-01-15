
import { supabase } from './supabase';
import { User, BarberProfile, Service, Booking, Review } from '../types';

export const db = {
  // --- USERS & PROFILES ---
  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) return db.getUsersSync();
      localStorage.setItem('trimly_users_cache', JSON.stringify(data));
      return (data as any) || [];
    } catch (e) { return db.getUsersSync(); }
  },

  getUsersSync: (): User[] => {
    const cached = localStorage.getItem('trimly_users_cache');
    return cached ? JSON.parse(cached) : [];
  },

  updateProfileDetails: async (userId: string, updates: { fullName?: string, avatarUrl?: string }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      console.log("LOG: Pokušaj sinkronizacije profila...", updates);

      let profileUpdated = false;
      let barberUpdated = false;

      // 1. Pokušaj ažurirati 'profiles' tablicu
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
      
      if (profileError) {
        if (profileError.message.includes("column") || profileError.code === '42703') {
          console.error("⚠️ SUPABASE GREŠKA: Kolone 'fullName' ili 'avatarUrl' ne postoje u tablici 'profiles'!");
          console.info("RJEŠENJE: Odi u Supabase SQL Editor i pokreni: ALTER TABLE profiles ADD COLUMN \"fullName\" text, ADD COLUMN \"avatarUrl\" text;");
        } else {
          console.error("❌ RLS ili druga greška u 'profiles':", profileError.message);
        }
      } else {
        profileUpdated = true;
      }

      // 2. Ako je korisnik barber, ažuriraj i tablicu 'barbers' (tamo kolone obično postoje)
      const active = db.getActiveUser();
      if (active && active.role === 'barber') {
        const bUpdates: any = {};
        if (updates.fullName) bUpdates.fullName = updates.fullName;
        if (updates.avatarUrl) bUpdates.profilePicture = updates.avatarUrl;

        if (Object.keys(bUpdates).length > 0) {
          const { error: barberError } = await supabase
            .from('barbers')
            .update(bUpdates)
            .eq('userId', userId);
            
          if (!barberError) barberUpdated = true;
          else console.warn("⚠️ Problem s ažuriranjem 'barbers' tablice:", barberError.message);
        }
      }

      // Smatramo uspjehom ako je barem jedna tablica prošla
      if (profileUpdated || barberUpdated) {
        if (active && active.id === userId) {
          const updatedUser = {
            ...active,
            fullName: updates.fullName !== undefined ? updates.fullName : active.fullName,
            avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : active.avatarUrl
          };
          db.setActiveUser(updatedUser);
        }
        window.dispatchEvent(new Event('user-profile-updated'));
        return true;
      }

      return false;
    } catch (err) {
      console.error("LOG: Kritična greška sustava:", err);
      return false;
    }
  },

  updateProfileRole: async (userId: string, role: string) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').upsert({ 
        id: userId, 
        role: role.toLowerCase().trim(),
        email: authUser?.email || ''
      }, { onConflict: 'id' });
      return !error;
    } catch (e) { return false; }
  },

  setUserBanStatus: async (userId: string, banned: boolean) => {
    const { error } = await supabase.from('profiles').update({ banned }).eq('id', userId);
    return !error;
  },

  deleteAccount: async (userId: string) => {
    try {
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.from('barbers').delete().eq('userId', userId);
      return true;
    } catch (e) { return false; }
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
    try {
      const { data, error } = await supabase.from('barbers').select('*').order('createdAt', { ascending: false });
      if (!error && data) {
        localStorage.setItem('trimly_barbers_cache', JSON.stringify(data));
        window.dispatchEvent(new Event('app-sync-complete'));
        return data as BarberProfile[];
      }
      return db.getBarbersSync();
    } catch (e) { return db.getBarbersSync(); }
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

  approveBarber: async (barberId: string) => {
    const { error } = await supabase.from('barbers').update({ approved: true }).eq('id', barberId);
    if (!error) await db.getBarbers();
    return !error;
  },

  // --- SERVICES ---
  getServices: async (barberId?: string): Promise<Service[]> => {
    try {
      let query = supabase.from('services').select('*');
      if (barberId) query = query.eq('barberId', barberId);
      const { data, error } = await query;
      if (!error && data) {
        localStorage.setItem('trimly_services_cache', JSON.stringify(data));
      }
      if (error) return db.getServicesSync();
      return (data as any) || [];
    } catch (e) { return db.getServicesSync(); }
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
    try {
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
    } catch (e) { return db.getBookingsSync(); }
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
    try {
      let query = supabase.from('reviews').select('*');
      if (barberId) query = query.eq('barberId', barberId);
      const { data, error } = await query;
      if (!error && data) {
        localStorage.setItem('trimly_reviews_cache', JSON.stringify(data));
      }
      if (error) return db.getReviewsSync();
      return (data as any) || [];
    } catch (e) { return db.getReviewsSync(); }
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
