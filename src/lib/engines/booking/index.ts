// Mesin Pesanan. Diisi agent-pesanan (Gelombang 2). Kontrak: ../contracts.ts
// Pakai binding dari ../contracts (schedule, booking, ...) hanya di dalam fungsi, bukan di tingkat atas modul.
import type { BookingEngine } from '../contracts';

const todo = (name: string) => (): never => {
  throw new Error(`Mesin Pesanan: ${name} belum diisi (agent-pesanan)`);
};

export const bookingEngine: BookingEngine = {
  createBooking: todo('createBooking'),
  respondBooking: todo('respondBooking'),
  startBooking: todo('startBooking'),
  completeBooking: todo('completeBooking'),
  cancelBooking: todo('cancelBooking'),
  expireStaleBookings: todo('expireStaleBookings'),
  runReminders: todo('runReminders'),
  getBookingForProvider: todo('getBookingForProvider'),
  getBookingForCitizen: todo('getBookingForCitizen'),
  getBookingForAdmin: todo('getBookingForAdmin'),
  listBookings: todo('listBookings'),
  findAlternatives: todo('findAlternatives'),
  submitReview: todo('submitReview')
};
