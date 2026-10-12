import type { AttributeType } from '@/features/listings/lib/format';

export const ATTRIBUTE_TYPE_OPTIONS: { value: AttributeType; label: string; hint: string }[] = [
  { value: 'text', label: 'Teks', hint: 'jawaban bebas' },
  { value: 'number', label: 'Angka', hint: 'bisa dipakai menyaring' },
  { value: 'boolean', label: 'Ya / Tidak', hint: 'mis. ada parkir' },
  { value: 'select', label: 'Pilihan', hint: 'pilih satu dari daftar' },
  { value: 'multiselect', label: 'Pilihan ganda', hint: 'boleh pilih banyak' }
];
export const attributeTypeLabel = (t: AttributeType) =>
  ATTRIBUTE_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;

// Isian yang sering dipakai; satu klik menambahkannya ke daftar isian khusus kategori.
export const ATTRIBUTE_SUGGESTIONS: {
  label: string;
  type: AttributeType;
  options?: string[];
}[] = [
  { label: 'Kapasitas (orang)', type: 'number' },
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
