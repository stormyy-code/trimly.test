
import { supabase } from './supabase';
import { User, BarberProfile, Service, Booking, Review } from '../types';

// Privatna memorija modula koja perzistira dok god je aplikacija otvorena
let _usersRegistry: User[] = [];
// Lista ID-ova koji su nedavno banani da bi spriječili "povratak" zbog mrežnog laga
const _recentBanLocks = new Map<string, boolean>();

export const db = {
  // --- USERS & PROFILES ---
  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) return db.getUsersSync();
      
      let users = (data as any) || [];
      
      // Ako imamo lokalne "lockove" (nedavne promjene licenci), force-amo to stanje
      if (_recentBanLocks.size > 0) {
        users = users.map(u => {
          if (_recentBanLocks.has(u.id)) {
            return { ...u, banned: _recentBanLocks.get(u.id) };
          }
          return u;
        });
      }

      _usersRegistry = users;
      localStorage.setItem('trimly_users_cache', JSON.stringify(users));
      return users;
    } catch (e) { return db.getUsersSync(); }
  },

  getUsersSync: (): User[] => {
    if (_usersRegistry.length > 0) return _usersRegistry;
    try {
      const cached = localStorage.getItem('trimly_users_cache');
      const parsed = cached ? JSON.parse(cached) : [];
      _usersRegistry = parsed;
      return parsed;
    } catch (e) { return []; }
  },

  updateProfileDetails: async (userId: string, updates: { fullName?: string, avatarUrl?: string }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
      
      if (profileError) return false;

      const active = db.getActiveUser();
      if (active && active.role === 'barber') {
        const bUpdates: any = {};
        if (updates.fullName) bUpdates.fullName = updates.fullName;
        if (updates.avatarUrl) bUpdates.profilePicture = updates.avatarUrl;

        if (Object.keys(bUpdates).length > 0) {
          await supabase.from('barbers').update(bUpdates).eq('userId', userId);
        }
      }

      _usersRegistry = _usersRegistry.map(u => u.id === userId ? { ...u, ...updates } : u);
      localStorage.setItem('trimly_users_cache', JSON.stringify(_usersRegistry));

      if (active && active.id === userId) {
        db.setActiveUser({ ...active, ...updates });
      }
      
      window.dispatchEvent(new Event('user-profile-updated'));
      return true;
    } catch (err) {
      return false;
    }
  },

  updateProfileRole: async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: role.toLowerCase().trim() })
        .eq('id', userId);
      
      if (error) return false;

      _usersRegistry = db.getUsersSync().map(u => u.id === userId ? { ...u, role: role as any } : u);
      localStorage.setItem('trimly_users_cache', JSON.stringify(_usersRegistry));

      const active = db.getActiveUser();
      if (active && active.id === userId) {
        db.setActiveUser({ ...active, role: role as any });
      }
      
      window.dispatchEvent(new Event('user-profile-updated'));
      return true;
    } catch (err) {
      return false;
    }
  },

  setUserBanStatus: async (userId: string, banned: boolean) => {
    try {
      const activeUser = db.getActiveUser();
      if (!activeUser || activeUser.role !== 'admin') {
        return { success: false, error: 'Samo administrator može upravljati licencama.' };
      }

      // 1. Ažuriraj bazu i odmah zatraži povratni podatak
      const { data: updateResult, error } = await supabase
        .from('profiles')
        .update({ banned })
        .eq('id', userId)
        .select('id, banned')
        .single();

      if (error) {
        console.error("Supabase Error:", error);
        return { success: false, error: error.message };
      }
      
      // 2. VERIFIKACIJA: Ako updateResult.banned nije ono što smo poslali, RLS blokira promjenu
      if (!updateResult || updateResult.banned !== banned) {
        return { 
          success: false, 
          error: 'Baza je odbila promjenu. Provjerite SQL polise (Admin dozvole).' 
        };
      }
      
      // 3. KLJUČNO: Dodaj lock u memoriju da fetch ne prebriše ovo stanje idućih 15 sekundi
      _recentBanLocks.set(userId, banned);
      setTimeout(() => _recentBanLocks.delete(userId), 15000);

      // Sinkroniziraj lokalno stanje odmah
      _usersRegistry = db.getUsersSync().map(u => u.id === userId ? { ...u, banned } : u);
      localStorage.setItem('trimly_users_cache', JSON.stringify(_usersRegistry));
      
      window.dispatchEvent(new CustomEvent('users-registry-updated', { 
        detail: { userId, banned } 
      }));
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
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
      return { success: false, error: err.message };
    }
  },

  approveBarber: async (barberId: string) => {
    const { error } = await supabase.from('barbers').update({ approved: true }).eq('id', barberId);
    if (!error) await db.getBarbers();
    return !error;
  },

  getServices: async (barberId?: string): Promise<Service[]> => {
    try {
      let query = supabase.from('services').select('*');
      if (barberId) query = query.eq('barberId', barberId);
      const { data, error } = await query;
      if (!error && data) {
        localStorage.setItem('trimly_services_cache', JSON.stringify(data));
      }
      return (data as any) || db.getServicesSync();
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
      return (data as any) || db.getBookingsSync();
    } catch (e) { return db.getBookingsSync(); }
  },

  getBookingsSync: (): Booking[] => {
    const cached = localStorage.getItem('trimly_bookings_cache');
    return cached ? JSON.parse(cached) : [];
  },

  createBooking: async (booking: any) => {
    try {
      const { error } = await supabase.from('bookings').insert(booking);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  updateBookingStatus: async (bookingId: string, status: string) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId);
    return !error;
  },

  deleteBooking: async (id: string) => {
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      return { success: !error, error: error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  getReviews: async (barberId?: string): Promise<Review[]> => {
    try {
      let query = supabase.from('reviews').select('*');
      if (barberId) query = query.eq('barberId', barberId);
      const { data, error } = await query;
      if (!error && data) {
        localStorage.setItem('trimly_reviews_cache', JSON.stringify(data));
      }
      return (data as any) || db.getReviewsSync();
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
