
import { ZagrebQuarter } from './types';

export const ZAGREB_QUARTERS: ZagrebQuarter[] = [
  { name: 'Donji Grad', lat: 45.8105, lng: 15.9781 },
  { name: 'Gornji Grad - Medveščak', lat: 45.8236, lng: 15.9768 },
  { name: 'Trnje', lat: 45.7997, lng: 15.9867 },
  { name: 'Maksimir', lat: 45.8233, lng: 16.0097 },
  { name: 'Peščenica - Žitnjak', lat: 45.8033, lng: 16.0333 },
  { name: 'Novi Zagreb - Istok', lat: 45.7758, lng: 16.0053 },
  { name: 'Novi Zagreb - Zapad', lat: 45.7667, lng: 15.9500 },
  { name: 'Trešnjevka - Sjever', lat: 45.8061, lng: 15.9453 },
  { name: 'Trešnjevka - Jug', lat: 45.7892, lng: 15.9328 },
  { name: 'Črnomerec', lat: 45.8222, lng: 15.9333 },
  { name: 'Stenjevec', lat: 45.8111, lng: 15.8944 },
  { name: 'Podsused - Vrapče', lat: 45.8278, lng: 15.8611 },
  { name: 'Podsljeme', lat: 45.8667, lng: 15.9667 },
  { name: 'Sesvete', lat: 45.8333, lng: 16.1167 }
];

export const HAIRCUT_STYLES = [
  'Fade',
  'Taper',
  'Buzz cut',
  'Beard trim',
  'Skin fade',
  'Long hair',
  'Classic scissors'
];

/** 
 * SECURITY CODES 
 */
export const BARBER_INVITE_CODE = 'BARBERS2026';
export const ADMIN_INVITE_CODE = 'JELKOVEC2026';

export const APP_CONFIG = {
  ADMIN_COMMISSION: 0.10,
  BARBER_SHARE: 0.90,
  CITY: 'Zagreb',
  CURRENCY: 'EUR'
};
