
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
  // Fix: changed b.last_updated_week to b.lastUpdatedWeek
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

  getUserNameById: (userId: string, fallback: string): string => {
    const users = db.getUsersSync();
    const user = users.find(u => u.id === userId);
    return user?.fullName || fallback;
  },

  updateProfileDetails: async (userId: string, updates: { fullName?: string, avatarUrl?: string }) => {
    try {
      const dbUpdates: any = {};
      if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatar_url;
      
      const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
      
      if (error) {
        console.error("Supabase Update Error:", error);
        return { success: false, error: error.message };
      }
      
      const active = db.getActiveUser();
      if (active && active.id === userId) {
        const updatedUser = { ...active };
        if (updates.fullName !== undefined) updatedUser.fullName = updates.fullName;
        if (updates.avatarUrl !== undefined) updatedUser.avatarUrl = updates.avatarUrl;
        db.setActiveUser(updatedUser);
      }
      
      await db.getUsers();
      window.dispatchEvent(new Event('user-profile-updated'));
      window.dispatchEvent(new Event('app-sync-complete'));
      return { success: true };
    } catch (err: any) { 
      return { success: false, error: err.message }; 
    }
  },

  updateProfileRole: async (userId: string, role: string) => {
    try {
      const cleanRole = role.toLowerCase().trim();
      const { error } = await supabase.from('profiles').update({ role: cleanRole }).eq('id', userId);
      
      if (!error) {
        const active = db.getActiveUser();
        if (active && active.id === userId) db.setActiveUser({ ...active, role: cleanRole as any });
        return { success: true };
      }
      return { success: false, error: error.message };
    } catch (err: any) { 
      return { success: false, error: err.message }; 
    }
  },

  setUserBanStatus: async (userId: string, banned: boolean) => {
    try {
      const { error } = await supabase.from('profiles').update({ banned }).eq('id', userId);
      return { success: !error, error: error?.message };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  deleteAccount: async (userId: string) => {
    try {
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.from('barbers').delete().eq('user_id', userId);
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
      const { data, error } = await supabase.from('barbers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map(mapBarberFromDb);
      localStorage.setItem('trimly_barbers_cache', JSON.stringify(mapped));
      return mapped;
    } catch (e) { return db.getBarbersSync(); }
  },

  getBarbersSync: (): BarberProfile[] => {
    const cached = localStorage.getItem('trimly_barbers_cache');
    return cached ? JSON.parse(cached) : [];
  },

  saveBarbers: async (barber: Partial<BarberProfile>) => {
    try {
      const dbData = mapBarberToDb(barber);
      const { error } = await supabase.from('barbers').upsert(dbData, { onConflict: 'user_id' });
      if (error) throw error;
      await db.getBarbers(); 
      return { success: true };
    } catch (err: any) {
      console.error("Save barber error:", err);
      return { success: false, error: err.message };
    }
  },

  approveBarber: async (barberId: string) => {
    try {
      const { error } = await supabase.from('barbers').update({ approved: true }).eq('id', barberId);
      if (error) throw error;
      await db.getBarbers();
      return { success: true };
    } catch (err: any) {
      console.error("Approve barber error:", err);
      return { success: false, error: err.message || "Baza podataka je odbila zahtjev." };
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
      if (!barberId) localStorage.setItem('trimly_services_cache', JSON.stringify(mapped));
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
      return { success: true };
    } catch (err: any) {
      console.error("Add service error:", err);
      return { success: false, error: err.message };
    }
  },

  deleteService: async (id: string) => {
    const { error } = await supabase.from('services').delete().eq('id', id);
    return !error;
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
      const currentCache: Booking[] = JSON.parse(localStorage.getItem('trimly_bookings_cache') || '[]');
      const updatedCache = [...currentCache.filter(bc => !mapped.some(m => m.id === bc.id)), ...mapped];
      localStorage.setItem('trimly_bookings_cache', JSON.stringify(updatedCache));
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
    } catch (err: any) {
      console.error("Supabase Booking Error:", err);
      return { success: false, error: err.message };
    }
  },

  updateBookingStatus: async (bookingId: string, status: string) => {
    try {
      const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId);
      if (error) throw error;
      const current = db.getBookingsSync();
      const updated = current.map(b => b.id === bookingId ? { ...b, status: status as any } : b);
      localStorage.setItem('trimly_bookings_cache', JSON.stringify(updated));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  deleteBooking: async (id: string) => {
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
      const current = db.getBookingsSync();
      const updated = current.filter(b => b.id !== id);
      localStorage.setItem('trimly_bookings_cache', JSON.stringify(updated));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
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
      if (!barberId) localStorage.setItem('trimly_reviews_cache', JSON.stringify(mapped));
      window.dispatchEvent(new Event('reviews-updated'));
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
      if (error) {
        console.error("Create Review Supabase Error:", error);
        return { success: false, error: error.message, code: error.code };
      }
      await db.getReviews();
      return { success: true };
    } catch (err: any) { 
      console.error("Create Review Exception:", err);
      return { success: false, error: err.message }; 
    }
  },
};
