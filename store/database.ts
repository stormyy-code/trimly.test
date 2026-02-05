
import { supabase } from './supabase';
import { User, BarberProfile, Service, Booking, Review } from '../types';

let _usersRegistry: User[] = [];

const mapBarberFromDb = (b: any): BarberProfile => ({
  id: b.id,
  userId: b.user_id,
  fullName: b.full_name || '',
  profilePicture: b.profile_picture || 'https://i.ibb.co/C5fL3Pz/trimly-logo.png',
  phoneNumber: b.phone_number || '',
  neighborhood: b.neighborhood || '',
  address: b.address || '',
  zipCode: b.zip_code || '',
  city: b.city || 'Zagreb',
  bio: b.bio || '',
  gallery: b.gallery || [],
  workMode: b.work_mode || 'classic',
  approved: !!b.approved,
  featured: !!b.featured,
  weeklyWinner: !!b.weekly_winner,
  createdAt: b.created_at,
  workingHours: b.working_hours || [],
  slotInterval: b.slot_interval || 45,
  lastUpdatedWeek: b.last_updated_week || 0
});

const mapBarberToDb = (b: Partial<BarberProfile>) => {
  const payload: any = {};
  if (b.id) payload.id = b.id;
  if (b.userId) payload.user_id = b.userId;
  if (b.fullName !== undefined) payload.full_name = b.fullName;
  if (b.profilePicture !== undefined) payload.profile_picture = b.profilePicture;
  if (b.phoneNumber !== undefined) payload.phone_number = b.phoneNumber;
  if (b.neighborhood !== undefined) payload.neighborhood = b.neighborhood;
  if (b.address !== undefined) payload.address = b.address;
  if (b.zipCode !== undefined) payload.zip_code = b.zipCode;
  if (b.city !== undefined) payload.city = b.city;
  if (b.bio !== undefined) payload.bio = b.bio;
  if (b.gallery !== undefined) payload.gallery = b.gallery;
  if (b.workMode !== undefined) payload.work_mode = b.workMode;
  if (b.approved !== undefined) payload.approved = b.approved;
  if (b.featured !== undefined) payload.featured = b.featured;
  if (b.weeklyWinner !== undefined) payload.weekly_winner = b.weeklyWinner;
  if (b.workingHours !== undefined) payload.working_hours = b.workingHours;
  if (b.slotInterval !== undefined) payload.slot_interval = b.slotInterval;
  if (b.lastUpdatedWeek !== undefined) payload.last_updated_week = b.lastUpdatedWeek;
  return payload;
};

const mapBookingFromDb = (b: any): Booking => ({
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
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const db = {
  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      const users = (data || []).map((u: any) => ({
        id: u.id,
        email: u.email || '',
        role: u.role || 'customer',
        fullName: u.full_name || '',
        avatarUrl: u.avatar_url || '',
        banned: !!u.banned
      }));
      _usersRegistry = users;
      localStorage.setItem('trimly_users_cache', JSON.stringify(users));
      window.dispatchEvent(new CustomEvent('users-registry-updated', { detail: { users } }));
      return users;
    } catch (e) { return db.getUsersSync(); }
  },

  getUsersSync: (): User[] => {
    const cached = localStorage.getItem('trimly_users_cache');
    return cached ? JSON.parse(cached) : [];
  },

  resolveName: (userId: string, fallback: string): string => {
    const users = db.getUsersSync();
    const user = users.find(u => u.id === userId);
    return user?.fullName || fallback || 'Korisnik';
  },

  getUserNameById: (userId: string, fallback: string): string => {
    return db.resolveName(userId, fallback);
  },

  updateProfileDetails: async (userId: string, updates: { fullName?: string, avatarUrl?: string }) => {
    try {
      const dbUpdates: any = {};
      if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
      const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
      if (error) return { success: false, error: error.message };
      
      const { data: barber } = await supabase.from('barbers').select('id').eq('user_id', userId).maybeSingle();
      if (barber && updates.fullName) {
        await supabase.from('barbers').update({ full_name: updates.fullName }).eq('user_id', userId);
      }

      await db.getUsers();
      
      const currentActive = db.getActiveUser();
      if (currentActive && currentActive.id === userId) {
        db.setActiveUser({ ...currentActive, ...updates });
      }
      
      window.dispatchEvent(new Event('user-profile-updated'));
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  updateProfileRole: async (userId: string, role: string, retries = 3) => {
    const cleanRole = role.toLowerCase().trim();
    for (let i = 0; i < retries; i++) {
      try {
        const { error } = await supabase.from('profiles').update({ role: cleanRole }).eq('id', userId);
        if (!error) {
          await db.getUsers(); 
          return { success: true };
        }
        await sleep(500);
      } catch (err: any) {
        if (i === retries - 1) return { success: false, error: err.message };
      }
    }
    return { success: false, error: "Failed to update role" };
  },

  setUserBanStatus: async (userId: string, banned: boolean) => {
    try {
      const { error } = await supabase.from('profiles').update({ banned }).eq('id', userId);
      await db.getUsers();
      return { success: !error, error: error?.message };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  deleteAccount: async (userId: string) => {
    try {
      // Prvo provjeravamo je li korisnik barber
      const { data: barber } = await supabase.from('barbers').select('id').eq('user_id', userId).maybeSingle();
      
      if (barber) {
        // Obriši sve vezano uz barbera (iako cascade to rješava, ovdje smo eksplicitni)
        await supabase.from('services').delete().eq('barber_id', barber.id);
        await supabase.from('reviews').delete().eq('barber_id', barber.id);
        await supabase.from('bookings').delete().eq('barber_id', barber.id);
        await supabase.from('barbers').delete().eq('id', barber.id);
      }
      
      // Obriši profile (ovo će ujedno obrisati i ostale ovisnosti)
      await supabase.from('profiles').delete().eq('id', userId);
      
      // Napomena: Ovo ne briše korisnika iz auth.users tablice (to može samo Admin API ili Dashboard)
      return true;
    } catch (e) { 
      console.error("Delete account error:", e);
      return false; 
    }
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
      const { data, error } = await supabase.from('barbers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map(mapBarberFromDb);
      localStorage.setItem('trimly_barbers_cache', JSON.stringify(mapped));
      return mapped;
    } catch (e) { return db.getBarbersSync(); }
  },

  getBarberByUserId: async (userId: string): Promise<BarberProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapBarberFromDb(data) : null;
    } catch (e) {
      const cached = db.getBarbersSync();
      return cached.find(b => b.userId === userId) || null;
    }
  },

  getBarbersSync: (): BarberProfile[] => {
    const cached = localStorage.getItem('trimly_barbers_cache');
    return cached ? JSON.parse(cached) : [];
  },

  saveBarbers: async (barber: Partial<BarberProfile>) => {
    try {
      const dbData = mapBarberToDb(barber);
      const { data: existing } = await supabase.from('barbers').select('id').eq('user_id', barber.userId).maybeSingle();
      
      let error;
      if (existing) {
        const { error: updateError } = await supabase.from('barbers').update(dbData).eq('user_id', barber.userId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('barbers').insert(dbData);
        error = insertError;
      }

      if (error) throw error;
      if (barber.userId && barber.fullName) {
        await supabase.from('profiles').update({ full_name: barber.fullName }).eq('id', barber.userId);
      }
      await db.getBarbers(); 
      await db.getUsers();
      return { success: true };
    } catch (err: any) { 
      console.error("DB Save Barbers Error:", err);
      return { success: false, error: err.message }; 
    }
  },

  approveBarber: async (barberId: string, userId: string) => {
    try {
      const { error: bError } = await supabase.from('barbers').update({ approved: true }).eq('id', barberId);
      if (bError) throw bError;
      const { error: pError } = await supabase.from('profiles').update({ role: 'barber' }).eq('id', userId);
      localStorage.removeItem('trimly_barbers_cache');
      localStorage.removeItem('trimly_users_cache');
      await Promise.all([db.getBarbers(), db.getUsers()]);
      return { success: true };
    } catch (err: any) { 
      console.error("Approve error:", err);
      return { success: false, error: err.message }; 
    }
  },

  getServices: async (barberId?: string): Promise<Service[]> => {
    try {
      let query = supabase.from('services').select('*');
      if (barberId) query = query.eq('barber_id', barberId);
      const { data, error } = await query;
      if (error) throw error;
      const mapped = (data || []).map((s: any) => ({
        id: s.id,
        barberId: s.barber_id,
        name: s.name,
        price: s.price,
        duration: s.duration,
        description: s.description,
        imageUrl: s.image_url
      }));
      
      if (!barberId) {
        localStorage.setItem('trimly_services_cache', JSON.stringify(mapped));
      } else {
        const cached = db.getServicesSync();
        const otherBarbersServices = cached.filter(s => s.barberId !== barberId);
        localStorage.setItem('trimly_services_cache', JSON.stringify([...otherBarbersServices, ...mapped]));
      }
      
      return mapped;
    } catch (e) { return db.getServicesSync(); }
  },

  getServicesSync: (): Service[] => {
    const cached = localStorage.getItem('trimly_services_cache');
    return cached ? JSON.parse(cached) : [];
  },

  addService: async (service: Service) => {
    try {
      const dbData = {
        id: service.id,
        barber_id: service.barberId,
        name: service.name,
        price: service.price,
        duration: service.duration,
        description: service.description,
        image_url: service.imageUrl
      };
      const { error } = await supabase.from('services').insert(dbData);
      if (error) throw error;
      await db.getServices(service.barberId);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  deleteService: async (id: string) => {
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  getBookings: async (userId?: string, role?: string): Promise<Booking[]> => {
    try {
      let query = supabase.from('bookings').select('*');
      if (userId && role) {
        const column = role === 'customer' ? 'customer_id' : 'barber_id';
        query = query.eq(column, userId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map(mapBookingFromDb);
      localStorage.setItem('trimly_bookings_cache', JSON.stringify(mapped));
      return mapped;
    } catch (e) { return db.getBookingsSync(); }
  },

  getBookingsSync: (): Booking[] => {
    const cached = localStorage.getItem('trimly_bookings_cache');
    return cached ? JSON.parse(cached) : [];
  },

  createBooking: async (booking: any) => {
    try {
      const { error } = await supabase.from('bookings').insert({
        id: booking.id,
        customer_id: booking.customerId,
        customer_name: booking.customerName,
        customer_email: booking.customerEmail,
        barber_id: booking.barberId,
        service_id: booking.serviceId,
        service_name: booking.serviceName,
        date: booking.date,
        time: booking.time,
        price: booking.price,
        status: booking.status || 'pending'
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  updateBookingStatus: async (bookingId: string, status: string) => {
    try {
      const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId);
      if (error) throw error;
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  deleteBooking: async (id: string) => {
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  getReviews: async (barberId?: string): Promise<Review[]> => {
    try {
      let query = supabase.from('reviews').select('*');
      if (barberId) query = query.eq('barber_id', barberId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map((r: any) => ({
        id: r.id,
        bookingId: r.booking_id,
        barberId: r.barber_id,
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerEmail: r.customer_email,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at
      }));

      const cachedStr = localStorage.getItem('trimly_reviews_cache');
      const cached = cachedStr ? JSON.parse(cachedStr) : [];
      
      let newCache;
      if (barberId) {
        const others = cached.filter((r: Review) => r.barberId !== barberId);
        newCache = [...others, ...mapped];
      } else {
        newCache = mapped;
      }
      
      localStorage.setItem('trimly_reviews_cache', JSON.stringify(newCache));
      return mapped;
    } catch (e) { return db.getReviewsSync(); }
  },

  getReviewsSync: (): Review[] => {
    const cached = localStorage.getItem('trimly_reviews_cache');
    return cached ? JSON.parse(cached) : [];
  },

  createReview: async (review: Review) => {
    try {
      const { error } = await supabase.from('reviews').insert({
        id: review.id,
        booking_id: review.bookingId,
        barber_id: review.barberId,
        customer_id: review.customerId,
        customer_name: review.customerName,
        customer_email: review.customerEmail,
        rating: review.rating,
        comment: review.comment,
        created_at: review.createdAt || new Date().toISOString()
      });
      if (error) throw error;
      window.dispatchEvent(new Event('reviews-updated'));
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },
};
