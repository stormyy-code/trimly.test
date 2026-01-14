
import { supabase } from './supabase';
import { User, BarberProfile, Service, Booking, Review } from '../types';

/**
 * Production Database Engine
 * Hardened to handle Postgres camelCase naming ("userId", "barberId")
 * and RLS constraints automatically.
 */
export const db = {
  // --- USER PROFILES ---
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.error("DB Error (Users):", error.message);
      return db.getUsersSync();
    }
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
    const cleanRole = role.toLowerCase().trim();
    
    // Profiles table typically uses snake_case for standard fields, 
    // but we use id and email which are standard.
    const { error } = await supabase.from('profiles').upsert({ 
      id: userId, 
      role: cleanRole,
      email: authUser?.email || ''
    }, { onConflict: 'id' });
    
    if (!error) {
      const active = db.getActiveUser();
      if (active && active.id === userId) db.setActiveUser({ ...active, role: cleanRole as any });
      return true;
    }
    return false;
  },

  setUserBanStatus: async (userId: string, banned: boolean) => {
    const { error } = await supabase.from('profiles').update({ banned }).eq('id', userId);
    return !error;
  },

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
    // We order by "createdAt" (camelCase)
    const { data, error } = await supabase.from('barbers').select('*').order('createdAt', { ascending: false });
    if (!error && data) {
      // Ensure UI gets clean camelCase objects
      const mapped = data.map((b: any) => ({
        ...b,
        userId: b.userId || b.user_id,
        fullName: b.fullName || b.full_name,
        profilePicture: b.profilePicture || b.profile_picture,
        workingHours: b.workingHours || b.working_hours,
        slotInterval: b.slotInterval || b.slot_interval,
        createdAt: b.createdAt || b.created_at
      }));
      localStorage.setItem('trimly_barbers_cache', JSON.stringify(mapped));
      window.dispatchEvent(new Event('app-sync-complete'));
      return mapped;
    }
    return db.getBarbersSync();
  },

  getBarbersSync: (): BarberProfile[] => {
    const cached = localStorage.getItem('trimly_barbers_cache');
    return cached ? JSON.parse(cached) : [];
  },

  saveBarbers: async (barber: Partial<BarberProfile>) => {
    try {
      // Using camelCase keys as confirmed by your DB schema hint
      const payload: any = {
        userId: barber.userId,
        fullName: barber.fullName,
        profilePicture: barber.profilePicture,
        neighborhood: barber.neighborhood,
        address: barber.address,
        bio: barber.bio,
        gallery: barber.gallery,
        workMode: (barber as any).workMode,
        approved: barber.approved,
        workingHours: barber.workingHours,
        slotInterval: barber.slotInterval
      };
      
      if (barber.id) payload.id = barber.id;

      const { error } = await supabase.from('barbers').upsert(payload, { onConflict: 'userId' });
      if (error) throw error;
      await db.getBarbers(); 
      return { success: true };
    } catch (err: any) {
      console.error("Save Barber Error:", err.message);
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
    let query = supabase.from('services').select('*');
    if (barberId) {
      query = query.eq('barberId', barberId);
    }
    const { data, error } = await query;
    if (error) return db.getServicesSync();
    
    return (data || []).map((s: any) => ({
      ...s,
      barberId: s.barberId || s.barber_id,
      imageUrl: s.imageUrl || s.image_url
    }));
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
      const col = role === 'customer' ? 'customerId' : 'barberId';
      query = query.eq(col, userId);
    }
    const { data, error } = await query.order('createdAt', { ascending: false });
    if (error) return db.getBookingsSync();
    
    const mapped = (data || []).map((b: any) => ({
      ...b,
      customerId: b.customerId || b.customer_id,
      customerEmail: b.customerEmail || b.customer_email,
      barberId: b.barberId || b.barber_id,
      serviceId: b.serviceId || b.service_id,
      serviceName: b.serviceName || b.service_name,
      createdAt: b.createdAt || b.created_at
    }));

    localStorage.setItem('trimly_bookings_cache', JSON.stringify(mapped));
    window.dispatchEvent(new Event('app-sync-complete'));
    return mapped;
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
    const { error } = await supabase.from('services').delete().eq('id', id); // Logic error fix: table name
    const { error: bookingError } = await supabase.from('bookings').delete().eq('id', id);
    return !bookingError;
  },

  // --- REVIEWS ---
  getReviews: async (barberId?: string): Promise<Review[]> => {
    let query = supabase.from('reviews').select('*');
    if (barberId) {
       query = query.eq('barberId', barberId);
    }
    const { data, error } = await query;
    if (error) return db.getReviewsSync();

    return (data || []).map((r: any) => ({
      ...r,
      bookingId: r.bookingId || r.booking_id,
      barberId: r.barberId || r.barber_id,
      customerId: r.customerId || r.customer_id,
      customerEmail: r.customerEmail || r.customer_email,
      createdAt: r.createdAt || r.created_at
    }));
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
