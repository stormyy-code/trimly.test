
export type UserRole = 'customer' | 'barber' | 'admin';
export type WorkMode = 'classic' | 'mobile' | 'both';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  avatarUrl?: string;
  banned?: boolean;
}

export interface ZagrebQuarter {
  name: string;
  lat: number;
  lng: number;
}

export interface BreakTime {
  startTime: string;
  endTime: string;
}

export interface WorkingDay {
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  breaks: BreakTime[];
}

export interface BarberProfile {
  id: string;
  userId: string;
  fullName: string;
  profilePicture: string;
  phoneNumber?: string;
  neighborhood: string;
  address: string;
  zipCode?: string;
  city?: string;
  bio: string;
  gallery: string[];
  workMode: WorkMode;
  approved: boolean;
  featured: boolean;
  weeklyWinner?: boolean;
  createdAt: string;
  workingHours: WorkingDay[];
  slotInterval: number;
  lastUpdatedWeek?: number;
}

export interface Service {
  id: string;
  barberId: string;
  name: string;
  price: number;
  duration?: string;
  description?: string;
  imageUrl?: string;
}

export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled' | 'no-show';

export interface Booking {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  barberId: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  price: number;
  status: BookingStatus;
  createdAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  barberId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
  createdAt: string;
}
