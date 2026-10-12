// Data CONTOH untuk mencoba panel dan chatbot. Bukan usaha sungguhan.
// Kategori, kebutuhan, dan kelompok memakai slug berawalan "contoh-"; listing berawalan "dummy-"
// dan nama "[DUMMY]". Hapus semuanya: bun run db:clear-contoh
import type { AttributeDef } from '@/features/listings/lib/format';

export const GROUPS = [
  { slug: 'contoh-kendaraan', name: 'Kendaraan & Angkutan' },
  { slug: 'contoh-rumah', name: 'Rumah & Perbaikan' },
  { slug: 'contoh-acara', name: 'Acara & Pernikahan' },
  { slug: 'contoh-kesehatan', name: 'Kesehatan' },
  { slug: 'contoh-wisata', name: 'Wisata & Penginapan' },
  { slug: 'contoh-kreatif', name: 'Kreatif & Digital' }
];

export type ContohCategory = {
  slug: string;
  name: string;
  group: string; // slug kelompok
  aliases: string[];
  needsLocation?: boolean;
  infoOnly?: boolean;
  attributes: AttributeDef[];
  // untuk pembangkit listing
  names: string[];
  summary: string;
  modes: ('on_site' | 'on_call' | 'online')[];
  price?: { min: [number, number]; unit: string; spread?: number; chance: number };
  keywords: string[];
};

export const CATEGORIES: ContohCategory[] = [
  {
    slug: 'contoh-servis-motor',
    name: 'Servis Motor',
    group: 'contoh-kendaraan',
    aliases: ['onda', 'bengkel motor'],
    attributes: [
      { key: 'panggilan', label: 'Bisa datang ke tempat', type: 'boolean' },
      {
        key: 'merek',
        label: 'Merek yang dilayani',
        type: 'multiselect',
        options: ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki']
      }
    ],
    names: [
      'Bengkel Onda Pak Rudi',
      'Bengkel Motor Sinar Jaya',
      'Servis Motor Panggilan 24 Jam',
      'Anugerah Motor',
      'Bengkel Lubeg Jaya',
      'Dua Roda Service'
    ],
    summary: 'Servis berkala, tambal ban, dan perbaikan mesin untuk sepeda motor.',
    modes: ['on_site', 'on_call'],
    price: { min: [30000, 120000], unit: 'per_visit', chance: 0.8 },
    keywords: ['tambal ban', 'ganti oli', 'motor mogok']
  },
  {
    slug: 'contoh-servis-ac',
    name: 'Servis AC',
    group: 'contoh-rumah',
    aliases: ['ac', 'cuci ac', 'pasang ac'],
    attributes: [
      { key: 'garansi', label: 'Garansi servis', type: 'boolean' },
      {
        key: 'jenis_ac',
        label: 'Jenis AC',
        type: 'multiselect',
        options: ['Split', 'Cassette', 'Standing']
      }
    ],
    names: [
      'Padang Dingin Service',
      'Cuci AC Mandiri',
      'Teknik AC Berkah',
      'Sejuk Abadi AC',
      'Andalas Service AC',
      'AC Express Padang'
    ],
    summary: 'Cuci, isi freon, dan perbaikan AC rumah serta kantor.',
    modes: ['on_call'],
    price: { min: [75000, 250000], unit: 'per_visit', chance: 0.85 },
    keywords: ['isi freon', 'ac tidak dingin', 'bongkar pasang']
  },
  {
    slug: 'contoh-katering',
    name: 'Katering',
    group: 'contoh-acara',
    aliases: ['catering', 'nasi kotak', 'nasi box'],
    attributes: [
      { key: 'min_porsi', label: 'Minimal pesanan (porsi)', type: 'number' },
      {
        key: 'menu',
        label: 'Jenis menu',
        type: 'multiselect',
        options: ['Nasi kapau', 'Masakan Padang', 'Prasmanan', 'Kue basah']
      }
    ],
    names: [
      'Katering Uni Et',
      'Dapur Mak Etek',
      'Nasi Kapau Uda Lin',
      'Katering Barokah',
      'Pak Haji Catering',
      'Dapur Ranah'
    ],
    summary: 'Nasi kotak dan prasmanan untuk acara keluarga, kantor, dan pesta.',
    modes: ['on_site', 'on_call'],
    price: { min: [22000, 40000], unit: 'per_person', chance: 0.85 },
    keywords: ['nasi kotak', 'prasmanan', 'acara kantor']
  },
  {
    slug: 'contoh-gedung-acara',
    name: 'Gedung Acara',
    group: 'contoh-acara',
    aliases: ['gedung', 'aula', 'gedung pernikahan'],
    attributes: [
      { key: 'capacity', label: 'Kapasitas (orang)', type: 'number' },
      { key: 'ber_ac', label: 'Ber-AC', type: 'boolean' },
      {
        key: 'parkir',
        label: 'Parkir',
        type: 'select',
        options: ['Luas', 'Terbatas', 'Tidak ada']
      }
    ],
    names: [
      'Gedung Serbaguna Anak Nagari',
      'Aula Mutiara',
      'Gedung Balairung Sari',
      'Graha Minang',
      'Gedung Pertemuan Andalas',
      'Balai Adat Rang Mudo'
    ],
    summary: 'Gedung untuk resepsi, rapat, dan acara keluarga.',
    modes: ['on_site'],
    price: { min: [3000000, 12000000], unit: 'per_event', chance: 0.7 },
    keywords: ['resepsi', 'rapat', 'sewa gedung']
  },
  {
    slug: 'contoh-rumah-sakit',
    name: 'Rumah Sakit',
    group: 'contoh-kesehatan',
    aliases: ['rs', 'rumah sakit umum', 'rsud'],
    attributes: [
      { key: 'bpjs', label: 'Terima BPJS', type: 'boolean' },
      { key: 'igd', label: 'IGD 24 jam', type: 'boolean' },
      {
        key: 'poli',
        label: 'Poli tersedia',
        type: 'multiselect',
        options: ['Umum', 'Anak', 'Kandungan', 'Gigi', 'Penyakit dalam']
      }
    ],
    names: [
      'RS Bunda Kanduang',
      'RS Sehat Sentosa',
      'RSU Ranah Minang',
      'RS Harapan Keluarga',
      'RS Ibu dan Anak Padang',
      'RS Karya Medika'
    ],
    summary: 'Rumah sakit dengan layanan rawat jalan dan rawat inap.',
    modes: ['on_site'],
    keywords: ['igd', 'rawat inap', 'berobat']
  },
  {
    slug: 'contoh-wisata-alam',
    name: 'Wisata Alam',
    group: 'contoh-wisata',
    aliases: ['wisata', 'objek wisata', 'tempat wisata'],
    infoOnly: true,
    attributes: [
      { key: 'tiket', label: 'Tiket masuk', type: 'select', options: ['Gratis', 'Berbayar'] },
      {
        key: 'fasilitas',
        label: 'Fasilitas',
        type: 'multiselect',
        options: ['Parkir', 'Toilet', 'Musala', 'Warung', 'Penginapan']
      }
    ],
    names: [
      'Pantai Air Manis',
      'Bukit Lampu',
      'Lembah Anai',
      'Danau Singkarak View',
      'Pantai Nirwana',
      'Bukit Cinta Wisata'
    ],
    summary: 'Objek wisata alam yang bisa dikunjungi sepanjang minggu.',
    modes: ['on_site'],
    price: { min: [0, 15000], unit: 'per_person', chance: 0.5 },
    keywords: ['piknik', 'pemandangan', 'liburan keluarga']
  },
  {
    slug: 'contoh-desain-logo',
    name: 'Desain Logo',
    group: 'contoh-kreatif',
    aliases: ['bikin logo', 'desainer', 'jasa desain'],
    needsLocation: false,
    attributes: [{ key: 'revisi', label: 'Jumlah revisi', type: 'number' }],
    names: [
      'Desainer Logo Minang',
      'Studio Kreatif Ranah',
      'Logo Cepat',
      'Pixel Nagari',
      'Desain Brand Lokal'
    ],
    summary: 'Desain logo dan identitas merek untuk usaha kecil, dikerjakan daring.',
    modes: ['online'],
    price: { min: [150000, 1200000], unit: 'per_project', chance: 0.9 },
    keywords: ['logo usaha', 'branding', 'kemasan']
  }
];

export const NEEDS = [
  {
    slug: 'contoh-pesta-pernikahan',
    name: 'Pesta Pernikahan',
    aliases: ['baralek', 'nikahan', 'resepsi'],
    categories: ['contoh-gedung-acara', 'contoh-katering']
  },
  {
    slug: 'contoh-ac-rusak',
    name: 'AC Rusak',
    aliases: ['ac mati', 'ac tidak dingin'],
    categories: ['contoh-servis-ac']
  },
  {
    slug: 'contoh-kendaraan-mogok',
    name: 'Kendaraan Mogok',
    aliases: ['mogok', 'montir'],
    categories: ['contoh-servis-motor']
  },
  {
    slug: 'contoh-liburan-akhir-pekan',
    name: 'Liburan Akhir Pekan',
    aliases: ['bajalan', 'piknik', 'weekend'],
    categories: ['contoh-wisata-alam']
  }
];

// [kata, arti, sudah dicek]
export const KAMUS: [string, string, boolean][] = [
  ['baralek', 'pesta pernikahan', true],
  ['lapau', 'warung atau kedai', true],
  ['onda', 'sepeda motor', true],
  ['oto', 'mobil', true],
  ['bajalan', 'bepergian atau jalan-jalan', true],
  ['randang', 'rendang', false],
  ['manggaleh', 'berjualan', false],
  ['sakik', 'sakit', false]
];
