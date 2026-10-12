// Data acuan awal: kategori (jenis listing) dan kebutuhan (situasi warga).
// Aman dijalankan berulang (bun run db:seed-reference): hanya menambah, tidak menimpa hasil ubahan di panel admin.
// Semua boleh diubah lewat panel. Ini titik awal, bukan daftar final.
import type { LegacyGroup } from '../seed-helpers';

type Attr = { key: string; label: string; type: 'text' | 'number' };
type Category = {
  slug: string;
  name: string;
  group: LegacyGroup;
  description: string;
  attributes?: Attr[];
};
type Need = { slug: string; name: string; description: string; categories: string[] };

export const CATEGORIES: Category[] = [
  // ───── Jasa ─────
  {
    slug: 'catering',
    name: 'Katering',
    group: 'service',
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
    description: 'Sewa tenda, kursi, meja, dan perlengkapan acara.'
  },
  {
    slug: 'traditional-attire-rental',
    name: 'Sewa Baju Adat',
    group: 'service',
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
    description: 'Servis, cuci, dan pasang AC.'
  },
  {
    slug: 'motorcycle-repair',
    name: 'Servis Motor',
    group: 'service',
    description: 'Bengkel dan montir motor, termasuk panggilan.'
  },
  {
    slug: 'car-repair',
    name: 'Servis Mobil',
    group: 'service',
    description: 'Bengkel dan montir mobil, termasuk panggilan.'
  },
  {
    slug: 'electronics-repair',
    name: 'Servis HP & Elektronik',
    group: 'service',
    description: 'Servis ponsel, laptop, dan elektronik rumah tangga.'
  },
  {
    slug: 'moving-transport',
    name: 'Angkut Barang',
    group: 'service',
    description: 'Pindahan rumah dan angkut barang.'
  },
  {
    slug: 'car-rental',
    name: 'Sewa Mobil & Travel',
    group: 'service',
    description: 'Rental kendaraan dan travel.',
    attributes: [{ key: 'vehicle_types', label: 'Jenis kendaraan', type: 'text' }]
  },
  {
    slug: 'handyman',
    name: 'Tukang',
    group: 'service',
    description: 'Tukang bangunan dan perbaikan rumah.'
  },
  {
    slug: 'plumber',
    name: 'Tukang Ledeng',
    group: 'service',
    description: 'Perbaikan pipa dan saluran air.'
  },
  {
    slug: 'electrician',
    name: 'Tukang Listrik',
    group: 'service',
    description: 'Instalasi dan perbaikan listrik.'
  },
  {
    slug: 'cleaning',
    name: 'Jasa Kebersihan',
    group: 'service',
    description: 'Bersih-bersih rumah dan kantor.'
  },
  { slug: 'laundry', name: 'Laundry', group: 'service', description: 'Cuci dan setrika pakaian.' },
  { slug: 'tailor', name: 'Penjahit', group: 'service', description: 'Jahit dan permak pakaian.' },
  {
    slug: 'salon',
    name: 'Salon & Barbershop',
    group: 'service',
    description: 'Perawatan rambut dan kecantikan.'
  },
  {
    slug: 'tutor',
    name: 'Guru Les Privat',
    group: 'service',
    description: 'Les privat dan bimbingan belajar.',
    attributes: [{ key: 'subjects', label: 'Mata pelajaran', type: 'text' }]
  },

  // ───── Tempat ─────
  {
    slug: 'event-venue',
    name: 'Gedung Acara',
    group: 'place',
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
    name: 'Lapangan Olahraga',
    group: 'place',
    description: 'Lapangan futsal, badminton, dan olahraga lain.'
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
    categories: ['car-rental', 'moving-transport']
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
    categories: ['salon', 'makeup-artist']
  },
  {
    slug: 'clothing',
    name: 'Pakaian dan jahitan',
    description: 'Menjahit, permak, atau mencari pakaian.',
    categories: ['tailor', 'fashion', 'traditional-attire-rental']
  }
];
