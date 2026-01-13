export type UserRole = 'customer' | 'barber' | 'admin';
export type WorkMode = 'classic' | 'mobile' | 'both';

export interface ZagrebQuarter {
  name: string;
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  password?: string;
  verified?: boolean;
  banned?: boolean;
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
  neighborhood: string;
  address: string;
  bio: string;
  lat: number;
  lng: number;
  gallery: string[];
  styles: string[];
  workMode: WorkMode;
  approved: boolean;
  featured: boolean;
  weeklyWinner?: boolean;
  createdAt: string;
  workingHours: WorkingDay[];
  blockedCustomers: string[];
  slotInterval: number; // Interval u minutama (30, 45, 60...)
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

export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export interface Booking {
  id: string;
  customerId: string;
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
  customerEmail: string;
  rating: number;
  comment: string;
  createdAt: string;
}