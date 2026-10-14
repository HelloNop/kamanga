// Kontrak empat mesin Kamanga tahap 1: Jadwal, Pesanan, Lokasi, Notifikasi (PRD 8.4, 8.5, 8.15, 8.6).
// Halaman, fitur, chat, dan mesin lain memanggil mesin HANYA lewat berkas ini:
//
//   import { booking, location, notify, schedule } from '@/lib/engines/contracts';
//
// Implementasi ada di src/lib/engines/<mesin>/index.ts (milik sub-agent masing-masing). Berkas ini milik lead;
// perubahan diminta lewat laporan.
//
// Aturan umum:
// - Mesin TIDAK mengecek login. Pemanggil (service / route) wajib memeriksa peran dan kepemilikan lebih dulu,
//   kecuali getBookingForProvider/getBookingForCitizen yang memang menyaring akses sendiri.
// - Semua waktu berupa Date (UTC di memori, timestamptz di database); jam dinding dihitung Asia/Jakarta
//   (lihat ./time.ts).
// - Uang dalam rupiah, bilangan bulat.
import type { db } from '@/db';
import { bookingEngine } from './booking';
import { locationEngine } from './location';
import { notifyEngine } from './notify';
import { scheduleEngine } from './schedule';

// ───────────────────────────── Umum ─────────────────────────────

/** Transaksi Drizzle (argumen callback db.transaction). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Point = { lat: number; lng: number };

export type ActorKind = 'citizen' | 'provider' | 'admin' | 'system';
/** Pelaku perubahan. userId kosong untuk sistem dan penyedia yang menjawab lewat tautan token. */
export type Actor = { kind: ActorKind; userId?: string | null };

/** Alamat absolut untuk tautan di pesan WA. Memakai APP_URL, cadangan BETTER_AUTH_URL. */
export const appUrl = (path: string) =>
  `${(process.env.APP_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000').replace(/\/$/, '')}${path}`;

export { paths } from './paths';

// ───────────────────────────── Mesin Jadwal (PRD 8.4) ─────────────────────────────

export type ScheduleKind = 'slot' | 'seat' | 'date_stock' | 'survey' | 'none';

/** free: bisa dipesan; held: ditahan pesanan yang menunggu jawaban; booked: pesanan diterima; blocked: blokir manual. */
export type SlotState = 'free' | 'held' | 'booked' | 'blocked';

export type Slot = {
  unitId: number;
  startsAt: Date;
  endsAt: Date;
  state: SlotState;
  /** Rupiah per slot (seat: per kursi); harga jam ramai bila isPeak. */
  price: number | null;
  isPeak: boolean;
  /** Kapasitas unit (seat: jumlah kursi; slot: 1). */
  capacity: number;
  /** Sisa kursi (seat) atau 1/0 (slot). */
  seatsLeft: number;
};

export type AvailabilityQuery = {
  unitIds: number[];
  from: Date;
  to: Date;
  /** Jumlah kursi yang dibutuhkan (seat). Bawaan 1. */
  seats?: number;
  /** true: ikut kembalikan slot yang tidak bisa dipesan (untuk kalender mitra). Bawaan false: hanya free. */
  includeTaken?: boolean;
};

/** Permintaan satu rentang waktu. Untuk slot boleh beberapa slot berurutan (durasi minimal). */
export type SlotRequest = { unitId: number; startsAt: Date; endsAt: Date; seats?: number };

export type HoldFailReason =
  | 'unit_inactive'
  | 'past'
  | 'closed' // di luar jam buka atau tanggal libur
  | 'misaligned' // tidak pas dengan batas slot
  | 'too_short' // kurang dari durasi minimal
  | 'blocked'
  | 'taken'
  | 'no_seats';

export type HoldResult =
  | { ok: true; price: number | null; exclusive: boolean }
  | { ok: false; reason: HoldFailReason };

export type BlockInput = {
  unitId: number;
  startsAt: Date;
  endsAt: Date;
  reason: 'walk_in' | 'whatsapp' | 'other';
  note?: string | null;
  actor: Actor;
};
export type BlockResult =
  | { ok: true; id: number }
  | { ok: false; reason: 'invalid' | 'conflict'; bookingIds?: number[] };

/** Pesanan aktif yang tidak lagi cocok dengan jam buka atau terkena blokir (ditampilkan ke penyedia). */
export type ScheduleConflict = {
  bookingId: number;
  code: string;
  unitId: number;
  startsAt: Date;
  endsAt: Date;
  problem: 'closed' | 'blocked';
};

export interface ScheduleEngine {
  /** Slot dari schedule_rules dikurangi pengecualian, blokir, pesanan aktif, dan tahanan. Urut waktu. */
  getAvailability(q: AvailabilityQuery): Promise<Slot[]>;
  /**
   * Memastikan rentang bisa dipesan dan MENGUNCI baris unit (select … for update) di dalam transaksi `tx`.
   * Dipanggil mesin Pesanan sebelum menyisipkan baris pesanan di transaksi yang sama. Tahanan sebenarnya
   * adalah pesanan berstatus `sent`; exclusion constraint `bookings_no_overlap` menjadi penjaga terakhir.
   */
  holdSlot(tx: Tx, req: SlotRequest): Promise<HoldResult>;
  /** Blokir manual. Mengunci unit; gagal 'conflict' bila menimpa pesanan aktif. */
  blockSlot(input: BlockInput): Promise<BlockResult>;
  unblockSlot(blockId: number, actor: Actor): Promise<void>;
  /** Pesanan aktif suatu listing yang bentrok dengan jam buka/pengecualian/blokir terbaru. */
  findConflicts(listingId: number): Promise<ScheduleConflict[]>;
}

// ───────────────────────────── Mesin Pesanan (PRD 8.5) ─────────────────────────────

export type BookingStatus =
  | 'sent'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'expired'
  | 'cancelled';

/** Status yang menahan slot / kursi. */
export const ACTIVE_BOOKING_STATUSES = ['sent', 'accepted', 'in_progress'] as const;

/** Aturan penting yang ditampilkan dan disetujui warga sebelum memesan (disalin ke bookings.rules_snapshot). */
export type RulesSnapshot = {
  minMinutes?: number;
  cancelBeforeMinutes?: number;
  dpRequired?: boolean;
  /** Baris tambahan yang ditampilkan, mis. "Sewa raket Rp20.000". */
  notes?: string[];
};

export type ServicePeriod = 'pagi' | 'siang' | 'sore' | 'malam';

export type CreateBookingInput = {
  citizenId: string;
  listingId: number;
  categoryId: number;
  /** Untuk kategori ber-jadwal (slot, seat). */
  slot?: SlotRequest;
  /** Untuk kategori tanpa jadwal (Ka servis): keluhan, tanggal "YYYY-MM-DD", bagian hari. */
  request?: { problem: string; preferredDate: string; period: ServicePeriod };
  /** Jumlah orang / kursi. Bawaan 1 (seat: wajib sama dengan slot.seats). */
  seats?: number;
  /** Kecamatan lokasi layanan (hasil location.resolvePoint / resolvePlaceName). */
  districtId?: number | null;
  /** Kontak warga. Disimpan di booking_contacts, baru terlihat penyedia setelah menerima. */
  contact: {
    name: string;
    phone: string;
    address?: string | null;
    point?: Point | null;
    note?: string | null;
  };
  details?: Record<string, unknown>;
  rulesAccepted: RulesSnapshot;
};

export type CreateBookingFail =
  | 'listing_unavailable' // bukan provider terbit, atau kategori tidak cocok
  | 'not_verified' // tingkat verifikasi di bawah contact_checked
  | 'no_whatsapp' // penyedia tidak punya nomor WA
  | 'needs_slot'
  | 'needs_request'
  | HoldFailReason;

export type BookingEventView = {
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  actor: ActorKind;
  reason: string | null;
  at: Date;
};

/** Pesanan tanpa kontak warga. Aman ditampilkan ke siapa pun yang berhak melihat pesanan. */
export type BookingView = {
  id: number;
  code: string;
  status: BookingStatus;
  listing: { id: number; slug: string; name: string; whatsapp: string | null };
  category: { id: number; name: string; doorSlug: string | null; scheduleKind: ScheduleKind };
  unit: { id: number; name: string } | null;
  startsAt: Date | null;
  endsAt: Date | null;
  seats: number;
  /** Nama kecamatan lokasi layanan. */
  district: string | null;
  details: Record<string, unknown>;
  rulesSnapshot: RulesSnapshot;
  price: number | null;
  respondBy: Date | null;
  createdAt: Date;
  events: BookingEventView[];
  review: { satisfied: boolean; stars: number | null; comment: string | null } | null;
};

export type BookingContact = {
  name: string;
  phone: string;
  address: string | null;
  point: Point | null;
  note: string | null;
};

/** contact selalu null sebelum status accepted (juga untuk rejected/expired/cancelled sebelum diterima). */
export type ProviderBookingView = BookingView & { contact: BookingContact | null };

/** Penyedia berakun (pemilik listing) atau siapa pun yang memegang token dari pesan WA. */
export type ProviderAccess = { bookingId: number; userId: string } | { token: string };

/** Pesan WA yang dibuat saat transisi (mode cadangan: tautan untuk ditampilkan sebagai tombol). */
export type TransitionResult =
  | { ok: true; status: BookingStatus; notices: WaSendResult[] }
  | { ok: false; reason: 'not_found' | 'invalid_transition' | 'too_late' };

export type BookingListFilter = {
  listingIds?: number[];
  citizenId?: string;
  status?: BookingStatus[];
  /** Pesanan yang dibuat / dijadwalkan dalam rentang ini. */
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
};

export interface BookingEngine {
  /**
   * Membuat pesanan berstatus `sent`: cek listing, tahan slot (schedule.holdSlot), simpan kontak terpisah,
   * catat booking_events, set respond_by dari kategori (atau pengaturan bawaan), lalu kirim `booking_new`
   * ke penyedia. providerNotice berisi tautan wa.me pada mode cadangan: tautan itu memuat token Terima/Tolak,
   * jadi JANGAN ditampilkan ke warga (warga tidak boleh melihat token, dan penyedia tidak boleh melihat nomor
   * warga sebelum menerima). Di mode cadangan pesan diteruskan tim dari nomor resmi Kamanga lewat
   * resendProviderNotice di dashboard admin.
   */
  createBooking(
    input: CreateBookingInput
  ): Promise<
    | { ok: true; bookingId: number; code: string; providerNotice: WaSendResult }
    | { ok: false; reason: CreateBookingFail }
  >;
  /** Bangun ulang pesan `booking_new` untuk pesanan `sent` (tautan token sama). Dipakai tim di dashboard admin
   *  untuk meneruskan pesanan ke penyedia dari nomor resmi Kamanga saat mode cadangan. Pemanggil wajib requireAdmin(). */
  resendProviderNotice(
    id: number
  ): Promise<
    { ok: true; notice: WaSendResult } | { ok: false; reason: 'not_found' | 'invalid_transition' }
  >;
  /** sent → accepted | rejected. Menerima membuka kontak dan mengirim booking_contact + booking_accepted. */
  respondBooking(
    id: number,
    decision: 'accept' | 'reject',
    actor: Actor,
    reason?: string
  ): Promise<TransitionResult>;
  /** accepted → in_progress. */
  startBooking(id: number, actor: Actor): Promise<TransitionResult>;
  /** accepted | in_progress → completed (pesanan ber-jadwal: hanya setelah starts_at), lalu review_request. */
  completeBooking(id: number, actor: Actor): Promise<TransitionResult>;
  /** Warga: sent kapan saja; accepted hanya sebelum batas pembatalan (rules_snapshot), selain itu too_late.
   *  Penyedia, admin, dan sistem (akun warga dihapus): sent/accepted/in_progress dengan alasan wajib.
   *  Yang diberi tahu: pihak yang tidak membatalkan (sistem → penyedia). */
  cancelBooking(id: number, actor: Actor, reason: string): Promise<TransitionResult>;
  /** sent yang lewat respond_by → expired, warga diberi tahu. Juga dipanggil malas saat pesanan dibaca. */
  expireStaleBookings(now?: Date): Promise<{ expired: number[] }>;
  /** Pengingat terjadwal: penyedia belum menjawab, warga sebelum jadwal, selesai otomatis, "Puas?". */
  runReminders(now?: Date): Promise<{ sent: number }>;
  getBookingForProvider(access: ProviderAccess): Promise<ProviderBookingView | null>;
  getBookingForCitizen(bookingId: number, citizenId: string): Promise<BookingView | null>;
  /** Untuk admin menangani pesanan macet: termasuk kontak. Pemanggil wajib requireAdmin(). */
  getBookingForAdmin(bookingId: number): Promise<ProviderBookingView | null>;
  /** Daftar pesanan TANPA kontak (dashboard mitra, admin, riwayat warga). */
  listBookings(filter: BookingListFilter): Promise<{ items: BookingView[]; total: number }>;
  /** Penyedia lain yang cocok (kategori sama, terbit, bisa dipesan) setelah ditolak/kedaluwarsa. */
  findAlternatives(
    bookingId: number,
    limit?: number
  ): Promise<{ listingId: number; slug: string; name: string }[]>;
  /** Ulasan warga untuk pesanan completed miliknya; satu ulasan per pesanan. */
  submitReview(
    bookingId: number,
    citizenId: string,
    input: { satisfied: boolean; stars?: number | null; comment?: string | null }
  ): Promise<
    { ok: true } | { ok: false; reason: 'not_found' | 'not_completed' | 'already_reviewed' }
  >;
}

// ───────────────────────────── Mesin Lokasi (PRD 8.15) ─────────────────────────────

export type LocationLevel = 'province' | 'city' | 'district' | 'village' | 'landmark';

export type Region = {
  id: number;
  name: string;
  level: LocationLevel;
  /** Nama induk untuk membedakan, mis. "Padang". */
  parentName: string | null;
  center: Point | null;
};

export type PointResolution = {
  village: Region | null;
  district: Region | null;
  city: Region | null;
  /** Untuk ditampilkan: "Kuranji, Padang". */
  label: string;
  /** Titik berada di wilayah yang dilayani Kamanga (tahap 1: Kota Padang). */
  inServiceRegion: boolean;
};

/** Konteks untuk menyelesaikan nama ambigu tanpa bertanya. */
export type PlaceContext = { lastLocationId?: number | null; savedLocationIds?: number[] };

export type PlaceResolution =
  | { kind: 'resolved'; region: Region }
  | { kind: 'ambiguous'; options: Region[] }
  | { kind: 'not_found' };

/** visit: warga datang ke penyedia (urut jarak titik usaha). call: penyedia datang (syarat area layanan,
 *  urut jarak markas). online: tanpa syarat lokasi. */
export type VisitMode = 'visit' | 'call' | 'online';

export type NearestQuery = {
  origin: Point;
  mode: VisitMode;
  listingIds?: number[];
  categoryIds?: number[];
  /** Batas jarak untuk mode visit. Kosong = tanpa batas. */
  radiusKm?: number;
  limit?: number;
};

export interface LocationEngine {
  /** Titik → kelurahan/kecamatan/kota lewat poligon. Koordinat TIDAK disimpan. null bila di luar semua poligon. */
  resolvePoint(p: Point): Promise<PointResolution | null>;
  /** Nama daerah → wilayah (gazetteer + sebutan lain). Ambigu diselesaikan cakupan layanan, lokasi terakhir,
   *  alamat tersimpan; 'ambiguous' hanya bila tetap ambigu. */
  resolvePlaceName(text: string, ctx?: PlaceContext): Promise<PlaceResolution>;
  /** Titik di dalam area layanan listing (daftar wilayah dan/atau radius dari markas). */
  isInServiceArea(listingId: number, p: Point): Promise<boolean>;
  /** Listing terbit urut jarak garis lurus; mode call menyaring dengan area layanan. distanceKm null = tanpa titik. */
  nearestListings(q: NearestQuery): Promise<{ listingId: number; distanceKm: number | null }[]>;
  /** "1,8 km", "650 m". */
  formatDistance(km: number): string;
  /** Wilayah (kota) yang dilayani Kamanga sekarang. */
  serviceRegionIds(): Promise<number[]>;
}

// ───────────────────────────── Mesin Notifikasi WA (PRD 8.6) ─────────────────────────────

/** Parameter setiap template. Teks pesan ada di src/lib/engines/notify (Bahasa Indonesia, Lampiran C PRD). */
export type WaParams = {
  /** Warga: kode OTP. Kode tidak pernah dicatat di wa_messages.params. */
  otp: { code: string };
  /** Penyedia: pesanan baru + tombol Terima/Tolak. item = "Lapangan Padel 2 · Sabtu, 18 Okt · 19.00–20.00". */
  booking_new: {
    code: string;
    door: string;
    listing: string;
    item: string;
    details: string;
    district: string;
    respondMinutes: number;
    link: string;
  };
  /** Penyedia: data warga setelah diterima. */
  booking_contact: {
    code: string;
    name: string;
    phone: string;
    address: string;
    note: string;
    link: string;
  };
  /** Penyedia: pengingat pesanan belum dijawab. */
  booking_reminder_provider: {
    code: string;
    listing: string;
    item: string;
    minutesLeft: number;
    link: string;
  };
  /** Penyedia: pertanyaan warga yang belum ada jawabannya. */
  question_new: { listing: string; question: string; link: string };
  /** Penyedia: ringkasan bulanan. */
  monthly_summary: { listing: string; month: string; bookings: number; newCustomers: number };
  /** Warga: pesanan diterima / ditolak / kedaluwarsa. link = halaman pesanan. */
  booking_accepted: { code: string; listing: string; item: string; link: string };
  booking_rejected: { code: string; listing: string; reason: string; link: string };
  booking_expired: { code: string; listing: string; link: string };
  /** Warga atau penyedia: pesanan dibatalkan pihak lain. link = halaman pesanan pihak penerima. */
  booking_cancelled: { code: string; listing: string; item: string; reason: string; link: string };
  /** Warga: pengingat sebelum jadwal. */
  booking_reminder: { code: string; listing: string; item: string; link: string };
  /** Warga: "Puas?" setelah selesai. */
  review_request: { code: string; listing: string; link: string };
  /** Warga: jawaban penyedia atas pertanyaannya. */
  question_answered: { listing: string; question: string; answer: string; link: string };
};
export type WaTemplate = keyof WaParams;

export type WaRecipient = { phone: string; role: 'provider' | 'citizen' };

export type WaSendResult = {
  mode: 'api' | 'fallback';
  /** sent: terkirim lewat API; link: mode cadangan, kirim lewat tautan; failed: API gagal (link tetap ada). */
  status: 'sent' | 'link' | 'failed';
  /** id baris wa_messages. */
  messageId: number;
  /** Tautan wa.me berisi pesan terisi (selalu ada; dipakai UI sebagai tombol cadangan). */
  link: string;
  /** Teks pesan yang dikirim / diisikan. */
  text: string;
};

export type OtpRequestResult =
  | { ok: true; mode: 'api' | 'fallback' }
  /** unavailable: produksi tanpa WhatsApp Business API (kode tidak bisa dikirim). */
  | { ok: false; reason: 'invalid_phone' | 'rate_limited' | 'unavailable' };

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'wrong' | 'expired' | 'too_many' | 'not_found' };

export interface NotifyEngine {
  /** Satu-satunya jalan mengirim WA. Mencatat wa_messages. Mode API hanya bila env WA diisi. */
  sendWa<T extends WaTemplate>(
    template: T,
    to: WaRecipient,
    params: WaParams[T],
    opts?: { bookingId?: number }
  ): Promise<WaSendResult>;
  /** Membuat kode, menyimpan hash-nya, mengirim lewat WA (cadangan: dicetak ke log server saat pengembangan). */
  requestOtp(phone: string): Promise<OtpRequestResult>;
  /** Dipakai Better Auth (verifyOTP) saat warga memasukkan kode. Kode sekali pakai. */
  verifyOtp(phone: string, code: string): Promise<OtpVerifyResult>;
}

// ───────────────────────────── Pintu masuk ─────────────────────────────

export const schedule: ScheduleEngine = scheduleEngine;
export const booking: BookingEngine = bookingEngine;
export const location: LocationEngine = locationEngine;
export const notify: NotifyEngine = notifyEngine;
