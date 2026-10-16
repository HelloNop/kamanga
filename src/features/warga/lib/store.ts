// Ingatan sesi di peramban (sessionStorage): pilihan lokasi dan isian sementara warga.
// Tidak pernah dikirim ke server kecuali saat warga mencari/memesan, dan hilang saat tab ditutup.
import type { LocChoice } from '../api/types';

const read = <T>(key: string): T | null => {
  try {
    const v = sessionStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, v: unknown) => {
  try {
    if (v === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(v));
  } catch {
    // mode privat / penyimpanan penuh: cukup tidak diingat
  }
};

export const loadLoc = () => read<LocChoice>('warga:lokasi');
export const saveLoc = (v: LocChoice | null) => write('warga:lokasi', v);

/** Isian yang dibawa dari halaman pintu ke halaman pesan (keluhan, tanggal, bagian hari). */
export type Draft = {
  problem?: string;
  date?: string;
  period?: string;
  address?: string;
  note?: string;
  /** Pilihan di halaman pesan, agar tidak hilang setelah masuk OTP. Hanya berlaku untuk slot yang sama. */
  slotKey?: string;
  endsAt?: string;
  racket?: boolean;
};
export const loadDraft = () => read<Draft>('warga:isian') ?? {};
export const saveDraft = (patch: Draft) => write('warga:isian', { ...loadDraft(), ...patch });
