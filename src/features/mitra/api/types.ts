import type { ListingStatus } from '@/features/listings/constants/listing-options';
import type { BookingStatus, BookingView, ScheduleKind, SlotState } from '@/lib/engines/contracts';
import type { CitizenNotice } from '../lib/notices';
import type { Pattern } from '../schemas';

export type Fail = { ok: false; message: string };
export type Ok<T = object> = { ok: true } & T;

/** Hasil aksi pesanan: notices = tombol "Kabari pemesan" (hanya pesan untuk warga, setelah kontak terbuka). */
export type ActionResult = Ok<{ status: BookingStatus; notices: CitizenNotice[] }> | Fail;

/** Usaha milik mitra (pemilih usaha dan menu). */
export type OwnedListing = {
  id: number;
  name: string;
  slug: string;
  status: ListingStatus;
  scheduleKind: ScheduleKind | null;
  categoryName: string | null;
};

export type Viewer = { id: string; role?: string | null };

// ───── Jadwal ─────

export type UnitView = {
  id: number;
  name: string;
  capacity: number;
  originLocationId: number | null;
  destinationLocationId: number | null;
  isActive: boolean;
  patterns: Pattern[];
};

export type ExceptionView = {
  id: number;
  date: string;
  unitId: number | null;
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
};

export type ConflictView = {
  bookingId: number;
  code: string;
  unitName: string;
  startsAt: Date;
  endsAt: Date;
  problem: 'closed' | 'blocked';
  /** Halaman pesanan mitra; kosong untuk admin. */
  href: string | null;
};

export type ScheduleEditorData = {
  listing: { id: number; name: string; scheduleKind: ScheduleKind | null };
  /** vendor: tautan ke halaman pesanan mitra boleh ditampilkan. */
  viewer: 'admin' | 'vendor';
  units: UnitView[];
  exceptions: ExceptionView[];
  conflicts: ConflictView[];
  /** Kota/kabupaten untuk rute travel. */
  cities: { id: number; name: string }[];
};

export type CalendarSlot = {
  startsAt: Date;
  endsAt: Date;
  state: SlotState;
  price: number | null;
  isPeak: boolean;
  capacity: number;
  seatsLeft: number;
  block: { id: number; reason: 'walk_in' | 'whatsapp' | 'other'; note: string | null } | null;
  /** Pesanan yang memakai slot ini (tanpa data warga). */
  bookings: {
    id: number;
    code: string;
    status: BookingStatus;
    seats: number;
    href: string | null;
  }[];
};

// ───── Tanya jawab ─────

export type QaItem = {
  id: number;
  question: string;
  answer: string | null;
  source: 'provider' | 'citizen';
  createdAt: Date;
};

export type QaData = {
  listing: { id: number; name: string; slug: string };
  viewer: 'admin' | 'vendor';
  /** Pertanyaan warga yang belum dijawab. */
  pending: QaItem[];
  /** Tanya jawab yang tampil ke warga, urut. */
  items: QaItem[];
};

/** Hasil menjawab pertanyaan warga. link hanya untuk admin (tim mengirim dari nomor resmi). */
export type AnswerResult = Ok<{ notified: 'sent' | 'link' | 'none'; link: string | null }> | Fail;

// ───── Beranda, ulasan, statistik ─────

export type MonthSummary = {
  booked: number;
  accepted: number;
  completed: number;
  newCustomers: number;
};

export type HomeData = {
  today: BookingView[];
  waiting: BookingView[];
  month: MonthSummary;
  tasks: { key: string; text: string; href: string }[];
};

export type ReviewView = {
  id: number;
  satisfied: boolean;
  stars: number | null;
  comment: string | null;
  createdAt: Date;
  item: string | null;
};

export type ReviewsData = {
  items: ReviewView[];
  total: number;
  satisfied: number;
  avgStars: number | null;
};

export type StatsData = {
  days: number;
  views: number;
  booked: number;
  answered: number;
  accepted: number;
  /** Jam WIB (0–23) dengan jumlah pesanan, urut terbanyak. */
  peakHours: { hour: number; count: number }[];
};
