
import { supabase } from './supabase';
import { User, BarberProfile, Service, Booking, Review } from '../types';

let _usersRegistry: User[] = [];

// Pomoćna funkcija za mapiranje iz baze (snake_case) u aplikaciju (camelCase)
const mapBarberFromDb = (b: any): BarberProfile => ({
  id: b.id,
  userId: b.user_id,
  fullName: b.full_name,
  profilePicture: b.profile_picture,
  phoneNumber: b.phone_number,
  neighborhood: b.neighborhood,
  address: b.address,
  zipCode: b.zip_code,
  city: b.city,
  bio: b.bio,
  gallery: b.gallery || [],
  workMode: b.work_mode,
  approved: b.approved,
  featured: b.featured,
  weeklyWinner: b.weekly_winner,
  createdAt: b.created_at,
  workingHours: b.working_hours || [],
  slotInterval: b.slot_interval,
  lastUpdatedWeek: b.last_updated_week
});

// Pomoćna funkcija za mapiranje u bazu
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

export const db = {
  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) return db.getUsersSync();
      let users = (data as any) || [];
      _usersRegistry = users;
      localStorage.setItem('trimly_users_cache', JSON.stringify(users));
      return users;
    } catch (e) { return db.getUsersSync(); }
  },

  getUsersSync: (): User[] => {
    if (_usersRegistry.length > 0) return _usersRegistry;
    try {
      const cached = localStorage.getItem('trimly_users_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) { return []; }
  },

  updateProfileDetails: async (userId: string, updates: { fullName?: string, avatarUrl?: string }) => {
    try {
      const dbUpdates: any = {};
      if (updates.fullName) dbUpdates.full_name = updates.fullName;
      if (updates.avatarUrl) dbUpdates.avatar_url = updates.avatarUrl;
      const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
      if (error) return false;
      window.dispatchEvent(new Event('user-profile-updated'));
      return true;
    } catch (err) { return false; }
  },

  updateProfileRole: async (userId: string, role: string) => {
    try {
      const { error } = await supabase.from('profiles').update({ role: role.toLowerCase().trim() }).eq('id', userId);
      return !error;
    } catch (err) { return false; }
  },

  setUserBanStatus: async (userId: string, banned: boolean) => {
    try {
      const { error } = await supabase.from('profiles').update({ banned }).eq('id', userId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  deleteAccount: async (userId: string) => {
    try {
      await supabase.from('profiles').delete().eq('id', userId);
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
      if (!error && data) {
        const mapped = data.map(mapBarberFromDb);
        localStorage.setItem('trimly_barbers_cache', JSON.stringify(mapped));
        window.dispatchEvent(new Event('app-sync-complete'));
        return mapped;
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
      const dbData = mapBarberToDb(barber);
      // Osiguravamo da imamo user_id jer je on ključan za RLS polise i OnConflict
      if (!dbData.user_id) throw new Error("Missing user_id for barber profile.");

      const { error } = await supabase.from('barbers').upsert(dbData, { onConflict: 'user_id' });
      
      if (error) {
        console.error("Supabase Save Error:", error);
        return { success: false, error: error.message };
      }
      
      await db.getBarbers(); 
      return { success: true };
    } catch (err: any) {
      console.error("DB SAVE EXCEPTION:", err);
      return { success: false, error: err.message || "Unknown database error" };
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
      if (barberId) query = query.eq('barber_id', barberId);
      const { data, error } = await query;
      if (!error && data) {
        const mapped = data.map((s: any) => ({
          id: s.id,
          barberId: s.barber_id,
          name: s.name,
          price: s.price,
          duration: s.duration,
          description: s.description,
          imageUrl: s.image_url
        }));
        localStorage.setItem('trimly_services_cache', JSON.stringify(mapped));
        return mapped;
      }
      return db.getServicesSync();
    } catch (e) { return db.getServicesSync(); }
  },

  getServicesSync: (): Service[] => {
    const cached = localStorage.getItem('trimly_services_cache');
    return cached ? JSON.parse(cached) : [];
  },

  addService: async (service: Service) => {
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
        const column = role === 'customer' ? 'customer_id' : 'barber_id';
        query = query.eq(column, userId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) {
        const mapped = data.map((b: any) => ({
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
        }));
        localStorage.setItem('trimly_bookings_cache', JSON.stringify(mapped));
        window.dispatchEvent(new Event('app-sync-complete'));
        return mapped;
      }
      return db.getBookingsSync();
    } catch (e) { return db.getBookingsSync(); }
  },

  getBookingsSync: (): Booking[] => {
    const cached = localStorage.getItem('trimly_bookings_cache');
    return cached ? JSON.parse(cached) : [];
  },

  createBooking: async (booking: any) => {
    try {
      const dbData = {
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
        status: booking.status
      };
      const { error } = await supabase.from('bookings').insert(dbData);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  updateBookingStatus: async (bookingId: string, status: string) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId);
    return !error;
  },

  deleteBooking: async (id: string) => {
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      return { success: !error, error: error?.message };
    } catch (err: any) { return { success: false, error: err.message }; }
  },

  getReviews: async (barberId?: string): Promise<Review[]> => {
    try {
      let query = supabase.from('reviews').select('*');
      if (barberId) query = query.eq('barber_id', barberId);
      const { data, error } = await query;
      if (!error && data) {
        const mapped = data.map((r: any) => ({
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
        localStorage.setItem('trimly_reviews_cache', JSON.stringify(mapped));
        return mapped;
      }
      return db.getReviewsSync();
    } catch (e) { return db.getReviewsSync(); }
  },

  getReviewsSync: (): Review[] => {
    const cached = localStorage.getItem('trimly_reviews_cache');
    return cached ? JSON.parse(cached) : [];
  },

  createReview: async (review: Review) => {
    const dbData = {
      id: review.id,
      booking_id: review.bookingId,
      barber_id: review.barberId,
      customer_id: review.customerId,
      customer_name: review.customerName,
      customer_email: review.customerEmail,
      rating: review.rating,
      comment: review.comment
    };
    const { error } = await supabase.from('reviews').insert(dbData);
    return !error;
  }
};
