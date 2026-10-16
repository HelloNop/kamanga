import type { AttributeType } from '@/features/listings/lib/format';

export const ATTRIBUTE_TYPE_OPTIONS: { value: AttributeType; label: string; hint: string }[] = [
  { value: 'text', label: 'Teks', hint: 'jawaban bebas' },
  { value: 'number', label: 'Angka', hint: 'bisa dipakai menyaring' },
  { value: 'boolean', label: 'Ya / Tidak', hint: 'mis. ada parkir' },
  { value: 'select', label: 'Pilihan', hint: 'pilih satu dari daftar' },
  { value: 'multiselect', label: 'Pilihan ganda', hint: 'boleh pilih banyak' },
  { value: 'rupiah', label: 'Rupiah', hint: 'mis. harga sewa raket' },
  { value: 'duration', label: 'Durasi', hint: 'disimpan dalam menit' }
];
export const attributeTypeLabel = (t: AttributeType) =>
  ATTRIBUTE_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;

// Nilai sama dengan enum schedule_kind. date_stock dan survey baru dipakai tahap 2 (belum bisa dipesan).
export const SCHEDULE_KINDS = ['slot', 'seat', 'date_stock', 'survey', 'none'] as const;
export type ScheduleKindValue = (typeof SCHEDULE_KINDS)[number];
export const SCHEDULE_KIND_LABELS: Record<ScheduleKindValue, string> = {
  slot: 'Slot jam',
  seat: 'Kursi per keberangkatan',
  date_stock: 'Tanggal + stok (tahap 2)',
  survey: 'Jadwal survei (tahap 2)',
  none: 'Tanpa jadwal'
};
export const SCHEDULE_KIND_HINTS: Record<ScheduleKindValue, string> = {
  slot: 'Lapangan, barber, salon: durasi tetap per unit',
  seat: 'Travel: jam berangkat × jumlah kursi per rute',
  date_stock: 'Sewa barang per hari dengan jumlah unit. Belum bisa dipesan.',
  survey: 'Kunjungan kos/kontrakan. Belum bisa dipesan.',
  none: 'Formulir permintaan (Ka servis) atau informasi saja'
};

// Isian yang sering dipakai; satu klik menambahkannya ke daftar isian khusus kategori.
export const ATTRIBUTE_SUGGESTIONS: {
  label: string;
  type: AttributeType;
  options?: string[];
}[] = [
  { label: 'Kapasitas (orang)', type: 'number' },
  { label: 'Durasi minimal', type: 'duration' },
  { label: 'Batas pembatalan', type: 'duration' },
  { label: 'Wajib DP', type: 'boolean' },
  { label: 'Minimal pesanan (porsi)', type: 'number' },
  { label: 'Jumlah kamar', type: 'number' },
  { label: 'Terima BPJS', type: 'boolean' },
  { label: 'Buka 24 jam', type: 'boolean' },
  { label: 'Ada parkir', type: 'boolean' },
  { label: 'Bisa antar ke tempat', type: 'boolean' },
  {
    label: 'Fasilitas',
    type: 'multiselect',
    options: ['AC', 'WiFi', 'Parkir', 'Toilet', 'Musala']
  },
  { label: 'Jenis kendaraan', type: 'select', options: ['Motor', 'Mobil', 'Motor dan mobil'] }
];

// Saran kelompok untuk memulai dari nol; hanya tampil selama daftar kelompok masih sedikit.
export const GROUP_SUGGESTIONS = [
  'Makanan & Minuman',
  'Acara & Pernikahan',
  'Rumah & Perbaikan',
  'Kendaraan & Angkutan',
  'Kesehatan',
  'Wisata & Penginapan',
  'Kreatif & Digital',
  'Produk Lokal'
];
