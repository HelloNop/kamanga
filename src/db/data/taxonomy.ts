// Data acuan awal: kategori (jenis listing) dan kebutuhan (situasi warga).
// Aman dijalankan berulang (bun run db:seed-reference): hanya menambah, tidak menimpa hasil ubahan di panel admin.
// Semua boleh diubah lewat panel. Ini titik awal, bukan daftar final.
import type { AttributeDef } from '@/features/listings/lib/format';
import type { LegacyGroup } from '../seed-helpers';

type ScheduleKind = 'slot' | 'seat' | 'date_stock' | 'survey' | 'none';
type Category = {
  slug: string;
  name: string;
  group: LegacyGroup;
  description: string;
  attributes?: AttributeDef[];
  /** Pintu utama (slug di data/doors.ts). Kosong = kategori tanpa pintu. */
  door?: string;
  /** Jenis jadwal (PRD 8.4). Bawaan none: formulir permintaan atau informasi saja. */
  schedule?: ScheduleKind;
  /** Batas waktu penyedia menjawab (menit). Kosong = pengaturan bawaan. */
  responseMinutes?: number;
};

// ───── Isian aturan yang dipakai ulang (PRD 8.8, Lampiran B) ─────
// Kunci min_duration, cancel_before, dp_required dibaca mesin Pesanan sebagai aturan penting.
const MIN_DURATION: AttributeDef = {
  key: 'min_duration',
  label: 'Durasi minimal',
  type: 'duration'
};
const CANCEL_BEFORE: AttributeDef = {
  key: 'cancel_before',
  label: 'Batas pembatalan',
  type: 'duration'
};
const DP_REQUIRED: AttributeDef = { key: 'dp_required', label: 'Wajib DP', type: 'boolean' };
const SPORT_FACILITIES: AttributeDef = {
  key: 'facilities',
  label: 'Fasilitas',
  type: 'multiselect',
  options: ['Kamar mandi', 'Tempat ganti', 'Parkir mobil', 'Musala', 'Kantin']
};
const SPORT_RULES = [MIN_DURATION, CANCEL_BEFORE, DP_REQUIRED, SPORT_FACILITIES];
const VISIT_FEE: AttributeDef = { key: 'visit_fee', label: 'Biaya kunjungan/cek', type: 'rupiah' };
const WARRANTY: AttributeDef = { key: 'warranty', label: 'Garansi pengerjaan', type: 'duration' };
const AFTER_HOURS: AttributeDef = {
  key: 'after_hours',
  label: 'Melayani di luar jam kerja',
  type: 'boolean'
};
const REPAIR_RULES = [VISIT_FEE, WARRANTY, AFTER_HOURS];
const HOME_SERVICE: AttributeDef = {
  key: 'home_service',
  label: 'Bisa dipanggil ke rumah',
  type: 'boolean'
};
type Need = { slug: string; name: string; description: string; categories: string[] };

export const CATEGORIES: Category[] = [
  // ───── Jasa ─────
  {
    slug: 'catering',
    name: 'Katering',
    group: 'service',
    door: 'ka-balanjo',
    description: 'Katering acara dan harian.',
    attributes: [{ key: 'min_order', label: 'Minimal pesanan (porsi)', type: 'number' }]
  },
  {
    slug: 'wedding-decoration',
    name: 'Dekorasi & Pelaminan',
    group: 'service',
    description: 'Dekorasi acara dan pelaminan.'
  },
  {
    slug: 'photography',
    name: 'Fotografer & Videografer',
    group: 'service',
    description: 'Foto dan video acara, produk, dan keluarga.'
  },
  {
    slug: 'makeup-artist',
    name: 'Rias & MUA',
    group: 'service',
    description: 'Rias pengantin dan rias acara.'
  },
  {
    slug: 'tent-rental',
    name: 'Sewa Tenda & Kursi',
    group: 'service',
    door: 'ka-manyewa',
    schedule: 'date_stock',
    description: 'Sewa tenda, kursi, meja, dan perlengkapan acara.'
  },
  {
    slug: 'traditional-attire-rental',
    name: 'Sewa Baju Adat',
    group: 'service',
    door: 'ka-manyewa',
    schedule: 'date_stock',
    description: 'Sewa pakaian adat dan busana acara.'
  },
  {
    slug: 'live-music',
    name: 'Orgen Tunggal & Musik',
    group: 'service',
    description: 'Hiburan musik untuk acara.'
  },
  {
    slug: 'event-organizer',
    name: 'EO & MC Acara',
    group: 'service',
    description: 'Penyelenggara acara dan pembawa acara.'
  },
  {
    slug: 'ac-repair',
    name: 'Servis AC',
    group: 'service',
    door: 'ka-servis',
    description: 'Servis, cuci, dan pasang AC.',
    attributes: [
      {
        key: 'brands',
        label: 'Merek yang dilayani',
        type: 'multiselect',
        options: [
          'Semua merek',
          'Daikin',
          'Panasonic',
          'LG',
          'Sharp',
          'Samsung',
          'Gree',
          'Polytron'
        ]
      },
      ...REPAIR_RULES
    ]
  },
  {
    slug: 'motorcycle-repair',
    name: 'Servis Motor',
    group: 'service',
    door: 'ka-servis',
    description: 'Bengkel dan montir motor, termasuk panggilan.',
    attributes: REPAIR_RULES
  },
  {
    slug: 'car-repair',
    name: 'Servis Mobil',
    group: 'service',
    door: 'ka-servis',
    description: 'Bengkel dan montir mobil, termasuk panggilan.',
    attributes: REPAIR_RULES
  },
  {
    slug: 'electronics-repair',
    name: 'Servis HP & Elektronik',
    group: 'service',
    door: 'ka-servis',
    description: 'Servis ponsel, laptop, dan elektronik rumah tangga.',
    attributes: REPAIR_RULES
  },
  {
    slug: 'moving-transport',
    name: 'Angkut Barang',
    group: 'service',
    door: 'ka-uda-anta',
    description: 'Pindahan rumah dan angkut barang.',
    attributes: [
      { key: 'vehicle', label: 'Kendaraan', type: 'select', options: ['Pickup', 'Engkel', 'Truk'] },
      { key: 'helpers_included', label: 'Termasuk tenaga angkut', type: 'boolean' }
    ]
  },
  {
    slug: 'car-rental',
    name: 'Sewa Mobil',
    group: 'service',
    door: 'ka-manyewa',
    schedule: 'date_stock',
    description: 'Rental kendaraan dan travel.',
    attributes: [{ key: 'vehicle_types', label: 'Jenis kendaraan', type: 'text' }]
  },
  {
    slug: 'handyman',
    name: 'Tukang',
    group: 'service',
    door: 'ka-servis',
    description: 'Tukang bangunan dan perbaikan rumah.',
    attributes: REPAIR_RULES
  },
  {
    slug: 'plumber',
    name: 'Tukang Ledeng',
    group: 'service',
    door: 'ka-servis',
    description: 'Perbaikan pipa dan saluran air.',
    attributes: REPAIR_RULES
  },
  {
    slug: 'electrician',
    name: 'Tukang Listrik',
    group: 'service',
    door: 'ka-servis',
    description: 'Instalasi dan perbaikan listrik.',
    attributes: REPAIR_RULES
  },
  {
    slug: 'cleaning',
    name: 'Jasa Kebersihan',
    group: 'service',
    door: 'ka-servis',
    description: 'Bersih-bersih rumah dan kantor.',
    attributes: [VISIT_FEE, AFTER_HOURS]
  },
  {
    slug: 'laundry',
    name: 'Laundry',
    group: 'service',
    door: 'ka-servis',
    description: 'Cuci dan setrika pakaian.',
    attributes: [
      { key: 'price_per_kg', label: 'Harga per kg', type: 'rupiah' },
      { key: 'pickup_delivery', label: 'Antar jemput', type: 'boolean' },
      { key: 'turnaround', label: 'Lama pengerjaan', type: 'duration' }
    ]
  },
  {
    slug: 'tailor',
    name: 'Penjahit',
    group: 'service',
    door: 'ka-servis',
    description: 'Jahit dan permak pakaian.'
  },
  {
    slug: 'salon',
    name: 'Salon',
    group: 'service',
    door: 'ka-rawat-diri',
    schedule: 'slot',
    description: 'Perawatan rambut dan kecantikan.',
    attributes: [
      {
        key: 'treatments',
        label: 'Layanan',
        type: 'multiselect',
        options: ['Potong rambut', 'Creambath', 'Smoothing', 'Pewarnaan', 'Hair spa', 'Rias harian']
      },
      { key: 'women_only', label: 'Khusus wanita', type: 'boolean' },
      CANCEL_BEFORE,
      DP_REQUIRED
    ]
  },
  {
    slug: 'tutor',
    name: 'Guru Les Privat',
    group: 'service',
    description: 'Les privat dan bimbingan belajar.',
    attributes: [{ key: 'subjects', label: 'Mata pelajaran', type: 'text' }]
  },

  // ───── Ka main (tahap 1) ─────
  {
    slug: 'futsal-court',
    name: 'Lapangan Futsal',
    group: 'place',
    description: 'Sewa lapangan futsal per jam.',
    door: 'ka-main',
    schedule: 'slot',
    attributes: SPORT_RULES
  },
  {
    slug: 'mini-soccer-field',
    name: 'Lapangan Mini Soccer',
    group: 'place',
    description: 'Sewa lapangan mini soccer per jam.',
    door: 'ka-main',
    schedule: 'slot',
    attributes: SPORT_RULES
  },
  {
    slug: 'padel-court',
    name: 'Lapangan Padel',
    group: 'place',
    description: 'Sewa lapangan padel per jam.',
    door: 'ka-main',
    schedule: 'slot',
    attributes: [
      MIN_DURATION,
      { key: 'racket_included', label: 'Termasuk raket', type: 'boolean' },
      { key: 'racket_price', label: 'Harga sewa raket', type: 'rupiah' },
      CANCEL_BEFORE,
      DP_REQUIRED,
      SPORT_FACILITIES
    ]
  },
  {
    slug: 'badminton-court',
    name: 'Lapangan Badminton',
    group: 'place',
    description: 'Sewa lapangan badminton per jam.',
    door: 'ka-main',
    schedule: 'slot',
    attributes: SPORT_RULES
  },
  {
    slug: 'billiard',
    name: 'Billiard',
    group: 'place',
    description: 'Sewa meja billiard per jam.',
    door: 'ka-main',
    schedule: 'slot',
    attributes: [MIN_DURATION, CANCEL_BEFORE, DP_REQUIRED]
  },
  {
    slug: 'karaoke',
    name: 'Karaoke',
    group: 'place',
    description: 'Sewa ruang karaoke per jam.',
    door: 'ka-main',
    schedule: 'slot',
    attributes: [
      { key: 'room_capacity', label: 'Kapasitas ruang (orang)', type: 'number' },
      MIN_DURATION,
      CANCEL_BEFORE,
      DP_REQUIRED
    ]
  },
  {
    slug: 'gym',
    name: 'Gym & Kebugaran',
    group: 'place',
    description: 'Pusat kebugaran, kunjungan harian dan bulanan.',
    door: 'ka-main',
    attributes: [
      { key: 'day_pass_price', label: 'Harga kunjungan harian', type: 'rupiah' },
      { key: 'monthly_price', label: 'Harga bulanan', type: 'rupiah' },
      { key: 'women_area', label: 'Ada area khusus wanita', type: 'boolean' }
    ]
  },

  // ───── Ka rawat diri (tahap 1) ─────
  {
    slug: 'barbershop',
    name: 'Barbershop',
    group: 'service',
    description: 'Potong rambut dan cukur pria.',
    door: 'ka-rawat-diri',
    schedule: 'slot',
    attributes: [
      { key: 'haircut_duration', label: 'Durasi potong rambut', type: 'duration' },
      { key: 'beard_duration', label: 'Durasi cukur jenggot', type: 'duration' },
      { key: 'wash_duration', label: 'Durasi cuci rambut', type: 'duration' },
      {
        key: 'reservation',
        label: 'Reservasi',
        type: 'select',
        options: ['Perlu reservasi', 'Bisa walk-in', 'Reservasi atau walk-in']
      },
      { key: 'late_tolerance', label: 'Batas keterlambatan', type: 'duration' },
      CANCEL_BEFORE,
      { key: 'accepts_children', label: 'Menerima anak-anak', type: 'boolean' }
    ]
  },
  {
    slug: 'spa-massage',
    name: 'Spa & Pijat',
    group: 'service',
    description: 'Spa, pijat, dan urut, di tempat atau panggilan.',
    door: 'ka-rawat-diri',
    schedule: 'slot',
    attributes: [
      HOME_SERVICE,
      {
        key: 'therapist_gender',
        label: 'Terapis',
        type: 'select',
        options: ['Pria', 'Wanita', 'Pria dan wanita']
      },
      MIN_DURATION,
      CANCEL_BEFORE
    ]
  },
  {
    slug: 'reflexology',
    name: 'Refleksi',
    group: 'service',
    description: 'Pijat refleksi kaki dan badan.',
    door: 'ka-rawat-diri',
    schedule: 'slot',
    attributes: [HOME_SERVICE, MIN_DURATION, CANCEL_BEFORE]
  },
  {
    slug: 'facial-skincare',
    name: 'Perawatan Wajah & Kulit',
    group: 'service',
    description: 'Facial dan perawatan kulit.',
    door: 'ka-rawat-diri',
    schedule: 'slot',
    attributes: [
      { key: 'treatments', label: 'Jenis perawatan', type: 'text' },
      CANCEL_BEFORE,
      DP_REQUIRED
    ]
  },

  // ───── Ka uda anta (tahap 1) ─────
  {
    slug: 'intercity-travel',
    name: 'Travel Antarkota',
    group: 'service',
    description: 'Travel antarkota berizin, jemput di alamat atau titik kumpul.',
    door: 'ka-uda-anta',
    schedule: 'seat',
    responseMinutes: 15,
    attributes: [
      {
        key: 'pickup_type',
        label: 'Jemput',
        type: 'select',
        options: ['Jemput di alamat', 'Titik kumpul', 'Alamat atau titik kumpul']
      },
      { key: 'vehicle_type', label: 'Jenis kendaraan', type: 'text' },
      { key: 'max_luggage', label: 'Barang bawaan maksimal', type: 'text' },
      { key: 'accepts_parcels', label: 'Menerima titip paket', type: 'boolean' },
      CANCEL_BEFORE,
      { key: 'permit_number', label: 'Nomor izin angkutan', type: 'text' }
    ]
  },
  {
    slug: 'parcel-delivery',
    name: 'Titip Paket',
    group: 'service',
    description: 'Titip dan antar paket antarkota.',
    door: 'ka-uda-anta',
    attributes: [
      { key: 'max_weight', label: 'Berat maksimal (kg)', type: 'number' },
      { key: 'same_day', label: 'Sampai hari yang sama', type: 'boolean' }
    ]
  },

  // ───── Tempat ─────
  {
    slug: 'event-venue',
    name: 'Gedung Acara',
    group: 'place',
    door: 'ka-manyewa',
    schedule: 'date_stock',
    description: 'Gedung dan aula untuk acara.',
    attributes: [{ key: 'capacity', label: 'Kapasitas (orang)', type: 'number' }]
  },
  {
    slug: 'lodging',
    name: 'Penginapan & Homestay',
    group: 'place',
    description: 'Hotel, penginapan, dan homestay.',
    attributes: [{ key: 'room_count', label: 'Jumlah kamar', type: 'number' }]
  },
  {
    slug: 'restaurant',
    name: 'Rumah Makan & Kafe',
    group: 'place',
    description: 'Tempat makan dan kafe.',
    attributes: [{ key: 'seating_capacity', label: 'Kapasitas tempat duduk', type: 'number' }]
  },
  {
    slug: 'sport-venue',
    name: 'Lapangan Olahraga Lain',
    group: 'place',
    door: 'ka-main',
    schedule: 'slot',
    description: 'Lapangan futsal, badminton, dan olahraga lain.',
    attributes: SPORT_RULES
  },

  {
    slug: 'pharmacy-24h',
    name: 'Apotek 24 Jam',
    group: 'place',
    description: 'Apotek yang buka 24 jam.'
  },
  {
    slug: 'emergency-room',
    name: 'IGD & Rumah Sakit',
    group: 'place',
    description: 'Instalasi gawat darurat dan rumah sakit.'
  },

  // ───── Wisata ─────
  {
    slug: 'nature-tourism',
    name: 'Wisata Alam',
    group: 'attraction',
    description: 'Gunung, danau, air terjun, dan alam terbuka.'
  },
  {
    slug: 'beach-tourism',
    name: 'Wisata Pantai & Bahari',
    group: 'attraction',
    description: 'Pantai, pulau, dan wisata laut.'
  },
  {
    slug: 'cultural-tourism',
    name: 'Wisata Budaya & Sejarah',
    group: 'attraction',
    description: 'Museum, rumah adat, dan situs sejarah.'
  },
  {
    slug: 'culinary-tourism',
    name: 'Wisata Kuliner',
    group: 'attraction',
    description: 'Kawasan dan tempat kuliner khas.'
  },
  {
    slug: 'family-recreation',
    name: 'Taman Rekreasi Keluarga',
    group: 'attraction',
    description: 'Taman bermain dan tempat rekreasi keluarga.'
  },

  // ───── Freelance ─────
  {
    slug: 'logo-design',
    name: 'Desain Logo',
    group: 'freelance',
    description: 'Pembuatan logo dan identitas usaha.'
  },
  {
    slug: 'graphic-design',
    name: 'Desain Grafis',
    group: 'freelance',
    description: 'Desain poster, kemasan, dan materi promosi.'
  },
  {
    slug: 'web-development',
    name: 'Pembuat Website & Aplikasi',
    group: 'freelance',
    description: 'Website, toko daring, dan aplikasi.'
  },
  {
    slug: 'social-media-content',
    name: 'Konten & Media Sosial',
    group: 'freelance',
    description: 'Pengelolaan dan pembuatan konten media sosial.'
  },
  {
    slug: 'video-editing',
    name: 'Editor Video',
    group: 'freelance',
    description: 'Penyuntingan video.'
  },
  {
    slug: 'writing-translation',
    name: 'Penulis & Penerjemah',
    group: 'freelance',
    description: 'Penulisan dan terjemahan.'
  },
  {
    slug: 'bookkeeping',
    name: 'Pembukuan & Pajak Usaha',
    group: 'freelance',
    description: 'Pencatatan keuangan dan pajak untuk usaha kecil.'
  },

  // ───── Produk (UMKM) ─────
  {
    slug: 'souvenir-food',
    name: 'Oleh-oleh & Makanan Khas',
    group: 'product',
    description: 'Makanan dan oleh-oleh khas Sumbar.'
  },
  {
    slug: 'handicraft-textile',
    name: 'Kerajinan & Songket',
    group: 'product',
    description: 'Kerajinan tangan, songket, dan tenun.'
  },
  {
    slug: 'fashion',
    name: 'Pakaian & Fashion',
    group: 'product',
    description: 'Pakaian dan aksesori.'
  },
  {
    slug: 'farm-produce',
    name: 'Hasil Pertanian & Perkebunan',
    group: 'product',
    description: 'Hasil tani, kebun, dan olahannya.'
  }
];

export const NEEDS: Need[] = [
  {
    slug: 'play-sports',
    name: 'Main olahraga',
    description: 'Sewa lapangan untuk main bareng teman.',
    categories: [
      'futsal-court',
      'mini-soccer-field',
      'padel-court',
      'badminton-court',
      'sport-venue'
    ]
  },
  {
    slug: 'hangout-fun',
    name: 'Hiburan dan nongkrong',
    description: 'Billiard, karaoke, dan tempat nongkrong.',
    categories: ['billiard', 'karaoke', 'restaurant']
  },
  {
    slug: 'go-home-town',
    name: 'Pulang kampung atau ke luar kota',
    description: 'Travel antarkota dan titip barang.',
    categories: ['intercity-travel', 'parcel-delivery']
  },
  {
    slug: 'relax-body',
    name: 'Badan pegal, mau dipijat',
    description: 'Pijat, urut, spa, dan refleksi.',
    categories: ['spa-massage', 'reflexology']
  },
  {
    slug: 'health-emergency',
    name: 'Butuh obat atau IGD malam hari',
    description: 'Apotek 24 jam dan IGD.',
    categories: ['pharmacy-24h', 'emergency-room']
  },
  {
    slug: 'wedding-event',
    name: 'Acara pernikahan',
    description: 'Menyiapkan pesta pernikahan.',
    categories: [
      'event-venue',
      'catering',
      'wedding-decoration',
      'photography',
      'makeup-artist',
      'tent-rental',
      'traditional-attire-rental',
      'live-music',
      'event-organizer'
    ]
  },
  {
    slug: 'ac-broken',
    name: 'AC rusak',
    description: 'AC tidak dingin, bocor, atau perlu dipasang.',
    categories: ['ac-repair']
  },
  {
    slug: 'vehicle-trouble',
    name: 'Kendaraan bermasalah',
    description: 'Motor atau mobil mogok dan perlu diservis.',
    categories: ['motorcycle-repair', 'car-repair']
  },
  {
    slug: 'home-repair',
    name: 'Rumah perlu diperbaiki',
    description: 'Perbaikan bangunan, pipa, dan listrik.',
    categories: ['handyman', 'plumber', 'electrician']
  },
  {
    slug: 'moving-house',
    name: 'Pindahan rumah',
    description: 'Pindah rumah atau angkut barang.',
    categories: ['moving-transport', 'handyman']
  },
  {
    slug: 'cleaning-help',
    name: 'Bersih-bersih dan cuci pakaian',
    description: 'Jasa kebersihan dan laundry.',
    categories: ['cleaning', 'laundry']
  },
  {
    slug: 'gadget-repair',
    name: 'HP atau elektronik rusak',
    description: 'Servis ponsel, laptop, dan elektronik.',
    categories: ['electronics-repair']
  },
  {
    slug: 'need-transport',
    name: 'Butuh kendaraan atau antar barang',
    description: 'Sewa kendaraan, travel, atau angkut barang.',
    categories: ['intercity-travel', 'parcel-delivery', 'moving-transport', 'car-rental']
  },
  {
    slug: 'weekend-trip',
    name: 'Wisata akhir pekan',
    description: 'Jalan-jalan dan tempat menginap.',
    categories: [
      'nature-tourism',
      'beach-tourism',
      'cultural-tourism',
      'family-recreation',
      'lodging'
    ]
  },
  {
    slug: 'eat-out',
    name: 'Cari tempat makan',
    description: 'Rumah makan, kafe, dan kuliner khas.',
    categories: ['restaurant', 'culinary-tourism']
  },
  {
    slug: 'souvenirs',
    name: 'Cari oleh-oleh',
    description: 'Oleh-oleh dan kerajinan khas.',
    categories: ['souvenir-food', 'handicraft-textile']
  },
  {
    slug: 'design-digital',
    name: 'Butuh desain atau website',
    description: 'Logo, desain, website, dan konten digital.',
    categories: [
      'logo-design',
      'graphic-design',
      'web-development',
      'social-media-content',
      'video-editing'
    ]
  },
  {
    slug: 'learning',
    name: 'Cari guru les',
    description: 'Les privat dan bimbingan belajar.',
    categories: ['tutor']
  },
  {
    slug: 'business-support',
    name: 'Bantuan untuk usaha',
    description: 'Pembukuan, promosi, dan foto produk.',
    categories: ['bookkeeping', 'social-media-content', 'photography', 'graphic-design']
  },
  {
    slug: 'beauty-care',
    name: 'Perawatan dan kecantikan',
    description: 'Salon, rias, dan penampilan.',
    categories: ['barbershop', 'salon', 'spa-massage', 'reflexology', 'facial-skincare']
  },
  {
    slug: 'clothing',
    name: 'Pakaian dan jahitan',
    description: 'Menjahit, permak, atau mencari pakaian.',
    categories: ['tailor', 'fashion', 'traditional-attire-rental']
  }
];
