import type { BookingView, ProviderBookingView, WaSendResult } from '@/lib/engines/contracts';

export type { WaSendResult };

export type BookingFilters = {
  page?: number;
  limit?: number;
  /** Status dipisah koma. */
  status?: string;
  /** Cari nama listing. */
  listing?: string;
  /** Rentang tanggal jadwal (atau tanggal dibuat untuk permintaan): "msDari,msSampai" dari filter tabel. */
  when?: string;
  /** 'stuck' = hanya pesanan macet. */
  flag?: string;
};

/** Pesanan tanpa kontak warga + alasan macet (null bila tidak). */
export type BookingRow = BookingView & { stuck: string | null };
export type BookingsResponse = { items: BookingRow[]; total: number };

/** Admin berhak melihat kontak warga untuk menangani pesanan macet. */
export type AdminBookingDetail = ProviderBookingView & {
  adminNote: string | null;
  stuck: string | null;
};

export type ActionResult = { ok: true; notices: WaSendResult[] } | { ok: false; message: string };
export type ForwardResult = { ok: true; notice: WaSendResult } | { ok: false; message: string };
export type NoteResult = { ok: true } | { ok: false; message: string };
