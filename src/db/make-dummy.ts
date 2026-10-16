// Membangkitkan data DUMMY ke data/dummy-listings.csv. Hasil selalu sama (acak dengan benih tetap).
// Semua nama diawali "[DUMMY]", slug diawali "dummy-", nomor WhatsApp palsu (628000...), dan bukan usaha sungguhan.
// Jalankan: bun run db:make-dummy   lalu   bun run db:seed-dummy   (hapus: bun run db:clear-dummy)
import { writeFileSync } from 'node:fs';

let seed = 20261010;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const between = (lo: number, hi: number, step = 1) =>
  lo + Math.floor((rand() * (hi - lo)) / step) * step;
const chance = (p: number) => rand() < p;

// ───── lokasi: pilihan berbobot, dengan titik tengah untuk koordinat listing ─────
type Place = { slugs: string[]; weight: number; center?: [number, number]; jitter: number };
const PLACES: Place[] = [
  {
    slugs: [
      'padang-barat',
      'padang-timur',
      'padang-utara',
      'padang-selatan',
      'nanggalo',
      'kuranji',
      'koto-tangah',
      'pauh',
      'lubuk-begalung',
      'lubuk-kilangan',
      'bungus-teluk-kabung'
    ],
    weight: 55,
    center: [-0.9471, 100.4172],
    jitter: 0.05
  },
  {
    slugs: ['guguk-panjang', 'mandiangin-koto-selayan', 'aur-birugo-tigo-baleh'],
    weight: 15,
    center: [-0.3055, 100.3692],
    jitter: 0.015
  },
  {
    slugs: ['payakumbuh-barat', 'payakumbuh-timur', 'payakumbuh-utara', 'payakumbuh-selatan'],
    weight: 8,
    center: [-0.22, 100.63],
    jitter: 0.02
  },
  { slugs: ['solok'], weight: 3, center: [-0.8, 100.65], jitter: 0.02 },
  { slugs: ['pariaman'], weight: 3, center: [-0.63, 100.12], jitter: 0.02 },
  { slugs: ['padang-panjang'], weight: 3, center: [-0.47, 100.4], jitter: 0.01 },
  { slugs: ['sawahlunto'], weight: 2, center: [-0.68, 100.77], jitter: 0.02 },
  {
    slugs: ['kab-agam', 'kab-tanah-datar', 'kab-pesisir-selatan', 'kab-lima-puluh-kota'],
    weight: 11,
    jitter: 0
  }
];
// Kota induk tiap lokasi (untuk area layanan layanan panggilan)
const CITY_OF = (slug: string) =>
  slug.startsWith('kab-') || ['solok', 'pariaman', 'padang-panjang', 'sawahlunto'].includes(slug)
    ? slug
    : ['guguk-panjang', 'mandiangin-koto-selayan', 'aur-birugo-tigo-baleh'].includes(slug)
      ? 'bukittinggi'
      : slug.startsWith('payakumbuh')
        ? 'payakumbuh'
        : 'padang';
const pickPlace = () => {
  let r = rand() * PLACES.reduce((a, p) => a + p.weight, 0);
  const p = PLACES.find((x) => (r -= x.weight) < 0) ?? PLACES[0];
  const slug = pick(p.slugs);
  const coords = p.center
    ? [p.center[0] + (rand() - 0.5) * p.jitter * 2, p.center[1] + (rand() - 0.5) * p.jitter * 2]
    : null;
  return { slug, lat: coords ? coords[0].toFixed(5) : '', lng: coords ? coords[1].toFixed(5) : '' };
};

// ───── kategori: nama, harga, cara layanan, atribut ─────
type Spec = {
  slug: string;
  n: number;
  names: string[];
  summary: string;
  modes: string;
  price?: [number, number, string, number?];
  keywords: string[];
  attrs?: () => string;
  contact?: boolean;
};
const SPECS: Spec[] = [
  {
    slug: 'catering',
    n: 5,
    names: ['Katering', 'Dapur', 'Katering Nasi Kapau'],
    summary: 'Katering masakan Padang untuk acara dan harian',
    modes: 'di tempat|panggilan',
    price: [30000, 90000, 'per orang', 1000],
    keywords: ['nasi kapau', 'masakan padang', 'nasi box'],
    attrs: () => `min_order=${between(20, 100, 10)}`
  },
  {
    slug: 'wedding-decoration',
    n: 3,
    names: ['Dekorasi', 'Pelaminan', 'Dekor'],
    summary: 'Dekorasi dan pelaminan untuk pesta pernikahan',
    modes: 'di tempat',
    price: [3000000, 20000000, 'per acara', 500000],
    keywords: ['pelaminan', 'dekorasi']
  },
  {
    slug: 'photography',
    n: 4,
    names: ['Studio Foto', 'Foto & Video', 'Juru Foto'],
    summary: 'Foto dan video acara keluarga serta produk',
    modes: 'panggilan',
    price: [1500000, 8000000, 'per acara', 250000],
    keywords: ['foto prewedding', 'video']
  },
  {
    slug: 'makeup-artist',
    n: 3,
    names: ['Rias Pengantin', 'MUA', 'Salon & Rias'],
    summary: 'Rias pengantin dan rias acara',
    modes: 'di tempat|panggilan',
    price: [500000, 4000000, 'per acara', 100000],
    keywords: ['rias', 'make up']
  },
  {
    slug: 'tent-rental',
    n: 3,
    names: ['Sewa Tenda', 'Persewaan', 'Tenda & Kursi'],
    summary: 'Sewa tenda, kursi, dan meja untuk acara',
    modes: 'panggilan',
    price: [500000, 3000000, 'per acara', 50000],
    keywords: ['tenda', 'kursi']
  },
  {
    slug: 'traditional-attire-rental',
    n: 3,
    names: ['Sewa Baju Adat', 'Busana Adat', 'Rumah Songket'],
    summary: 'Sewa baju adat dan busana acara',
    modes: 'di tempat',
    price: [300000, 2500000, 'per acara', 50000],
    keywords: ['baju adat', 'suntiang']
  },
  {
    slug: 'live-music',
    n: 3,
    names: ['Orgen Tunggal', 'Musik', 'Hiburan'],
    summary: 'Hiburan musik organ tunggal untuk acara',
    modes: 'panggilan',
    price: [1000000, 5000000, 'per acara', 250000],
    keywords: ['orgen tunggal', 'musik']
  },
  {
    slug: 'event-organizer',
    n: 3,
    names: ['EO', 'Event Organizer', 'MC & EO'],
    summary: 'Penyelenggara dan pembawa acara',
    modes: 'panggilan',
    price: [2000000, 15000000, 'per acara', 500000],
    keywords: ['eo', 'mc']
  },
  {
    slug: 'ac-repair',
    n: 5,
    names: ['Servis AC', 'Dingin Jaya AC', 'Teknik AC'],
    summary: 'Cuci, servis, dan pasang AC panggilan',
    modes: 'panggilan',
    price: [50000, 250000, 'per kunjungan', 5000],
    keywords: ['cuci ac', 'isi freon', 'ac bocor']
  },
  {
    slug: 'motorcycle-repair',
    n: 5,
    names: ['Bengkel Onda', 'Bengkel Motor', 'Montir Motor'],
    summary: 'Bengkel dan montir motor, siap panggilan',
    modes: 'di tempat|panggilan',
    price: [30000, 200000, 'per kunjungan', 5000],
    keywords: ['servis motor', 'ganti oli', 'onda mogok']
  },
  {
    slug: 'car-repair',
    n: 4,
    names: ['Bengkel Oto', 'Bengkel Mobil', 'Montir Mobil'],
    summary: 'Servis dan perbaikan mobil',
    modes: 'di tempat|panggilan',
    price: [100000, 800000, 'per kunjungan', 10000],
    keywords: ['servis mobil', 'oto mogok']
  },
  {
    slug: 'electronics-repair',
    n: 4,
    names: ['Servis HP', 'Servis Laptop', 'Elektronik'],
    summary: 'Servis ponsel, laptop, dan elektronik rumah',
    modes: 'di tempat',
    price: [50000, 500000, 'per item', 10000],
    keywords: ['servis hp', 'ganti layar']
  },
  {
    slug: 'moving-transport',
    n: 4,
    names: ['Angkut Barang', 'Pindahan', 'Jasa Angkut'],
    summary: 'Pindahan rumah dan angkut barang',
    modes: 'panggilan',
    price: [150000, 1500000, 'per acara', 50000],
    keywords: ['pindahan', 'pickup']
  },
  {
    slug: 'car-rental',
    n: 4,
    names: ['Rental Mobil', 'Travel', 'Sewa Mobil'],
    summary: 'Sewa mobil lepas kunci atau dengan sopir',
    modes: 'di tempat|panggilan',
    price: [350000, 900000, 'per hari', 25000],
    keywords: ['rental mobil', 'travel'],
    attrs: () =>
      `vehicle_types=${pick(['Avanza', 'Innova', 'Xenia', 'Brio'])}, ${pick(['Hiace', 'Pajero', 'Ertiga'])}`
  },
  {
    slug: 'handyman',
    n: 4,
    names: ['Tukang', 'Tukang Bangunan', 'Jasa Renovasi'],
    summary: 'Tukang bangunan dan perbaikan rumah',
    modes: 'panggilan',
    price: [100000, 300000, 'per hari', 10000],
    keywords: ['tukang', 'renovasi']
  },
  {
    slug: 'plumber',
    n: 3,
    names: ['Tukang Ledeng', 'Servis Pipa', 'Saluran Air'],
    summary: 'Perbaikan pipa dan saluran air',
    modes: 'panggilan',
    price: [75000, 250000, 'per kunjungan', 5000],
    keywords: ['pipa bocor', 'ledeng']
  },
  {
    slug: 'electrician',
    n: 3,
    names: ['Tukang Listrik', 'Teknik Listrik', 'Instalasi Listrik'],
    summary: 'Instalasi dan perbaikan listrik rumah',
    modes: 'panggilan',
    price: [75000, 250000, 'per kunjungan', 5000],
    keywords: ['listrik', 'instalasi']
  },
  {
    slug: 'cleaning',
    n: 3,
    names: ['Jasa Kebersihan', 'Bersih Rumah', 'Cleaning Service'],
    summary: 'Bersih-bersih rumah dan kantor',
    modes: 'panggilan',
    price: [100000, 500000, 'per kunjungan', 10000],
    keywords: ['bersih rumah', 'cleaning']
  },
  {
    slug: 'laundry',
    n: 3,
    names: ['Laundry', 'Laundry Kiloan', 'Cuci Setrika'],
    summary: 'Cuci dan setrika pakaian, antar jemput',
    modes: 'di tempat|panggilan',
    price: [5000, 15000, 'per item', 500],
    keywords: ['laundry kiloan', 'cuci setrika']
  },
  {
    slug: 'tailor',
    n: 3,
    names: ['Penjahit', 'Jahit & Permak', 'Butik'],
    summary: 'Jahit dan permak pakaian',
    modes: 'di tempat',
    price: [50000, 300000, 'per item', 10000],
    keywords: ['jahit', 'permak']
  },
  {
    slug: 'salon',
    n: 3,
    names: ['Salon', 'Barbershop', 'Salon Muslimah'],
    summary: 'Potong rambut dan perawatan',
    modes: 'di tempat',
    price: [30000, 250000, 'per kunjungan', 5000],
    keywords: ['potong rambut', 'salon']
  },
  {
    slug: 'tutor',
    n: 3,
    names: ['Les Privat', 'Bimbel', 'Guru Les'],
    summary: 'Les privat dan bimbingan belajar',
    modes: 'di tempat|panggilan|daring',
    price: [50000, 150000, 'per jam', 5000],
    keywords: ['les privat', 'bimbel'],
    attrs: () =>
      `subjects=${pick(['Matematika', 'Bahasa Inggris', 'Fisika', 'Kimia'])}, ${pick(['Biologi', 'Ekonomi', 'Akuntansi'])}`
  },
  {
    slug: 'event-venue',
    n: 4,
    names: ['Gedung Serbaguna', 'Aula', 'Balairung'],
    summary: 'Gedung dan aula untuk acara',
    modes: 'di tempat',
    price: [3000000, 15000000, 'per acara', 500000],
    keywords: ['gedung pernikahan', 'aula'],
    attrs: () => `capacity=${between(100, 1000, 50)}`
  },
  {
    slug: 'lodging',
    n: 3,
    names: ['Homestay', 'Penginapan', 'Wisma'],
    summary: 'Penginapan bersih dan nyaman',
    modes: 'di tempat',
    price: [150000, 800000, 'per hari', 25000],
    keywords: ['penginapan', 'homestay'],
    attrs: () => `room_count=${between(5, 60, 5)}`
  },
  {
    slug: 'restaurant',
    n: 4,
    names: ['Rumah Makan', 'Kafe', 'Lapau'],
    summary: 'Masakan Minang dan menu harian',
    modes: 'di tempat',
    price: [15000, 60000, 'per orang', 1000],
    keywords: ['rumah makan', 'masakan minang'],
    attrs: () => `seating_capacity=${between(20, 200, 10)}`
  },
  {
    slug: 'sport-venue',
    n: 2,
    names: ['Lapangan Futsal', 'GOR'],
    summary: 'Lapangan olahraga sewa per jam',
    modes: 'di tempat',
    price: [75000, 250000, 'per jam', 5000],
    keywords: ['futsal', 'badminton']
  },
  {
    slug: 'nature-tourism',
    n: 3,
    names: ['Wisata Bukit', 'Air Terjun', 'Danau'],
    summary: 'Wisata alam untuk keluarga',
    modes: 'di tempat',
    price: [0, 30000, 'per orang', 5000],
    keywords: ['wisata alam'],
    contact: false
  },
  {
    slug: 'beach-tourism',
    n: 3,
    names: ['Pantai', 'Wisata Bahari', 'Pulau'],
    summary: 'Wisata pantai dan bahari',
    modes: 'di tempat',
    price: [0, 50000, 'per orang', 5000],
    keywords: ['pantai'],
    contact: false
  },
  {
    slug: 'cultural-tourism',
    n: 3,
    names: ['Museum', 'Rumah Gadang', 'Situs Sejarah'],
    summary: 'Wisata budaya dan sejarah',
    modes: 'di tempat',
    price: [0, 25000, 'per orang', 5000],
    keywords: ['rumah gadang', 'sejarah'],
    contact: false
  },
  {
    slug: 'culinary-tourism',
    n: 2,
    names: ['Kawasan Kuliner', 'Pasar Kuliner'],
    summary: 'Kawasan kuliner khas',
    modes: 'di tempat',
    keywords: ['kuliner'],
    contact: false
  },
  {
    slug: 'family-recreation',
    n: 2,
    names: ['Taman Rekreasi', 'Taman Bermain'],
    summary: 'Rekreasi keluarga dan taman bermain',
    modes: 'di tempat',
    price: [10000, 60000, 'per orang', 5000],
    keywords: ['taman bermain']
  },
  {
    slug: 'logo-design',
    n: 3,
    names: ['Desain Logo', 'Studio Logo', 'Logo Cepat'],
    summary: 'Logo dan identitas usaha',
    modes: 'daring',
    price: [150000, 1500000, 'per proyek', 50000],
    keywords: ['logo', 'branding']
  },
  {
    slug: 'graphic-design',
    n: 3,
    names: ['Desain Grafis', 'Studio Desain', 'Poster & Kemasan'],
    summary: 'Desain poster, kemasan, dan materi promosi',
    modes: 'daring',
    price: [100000, 1000000, 'per proyek', 50000],
    keywords: ['poster', 'kemasan']
  },
  {
    slug: 'web-development',
    n: 3,
    names: ['Web Developer', 'Jasa Website', 'Toko Online'],
    summary: 'Website, toko daring, dan aplikasi',
    modes: 'daring',
    price: [1500000, 15000000, 'per proyek', 500000],
    keywords: ['website', 'toko online']
  },
  {
    slug: 'social-media-content',
    n: 3,
    names: ['Konten Kreator', 'Kelola Medsos', 'Studio Konten'],
    summary: 'Pengelolaan dan pembuatan konten media sosial',
    modes: 'daring',
    price: [1000000, 5000000, 'per proyek', 250000],
    keywords: ['konten', 'instagram']
  },
  {
    slug: 'video-editing',
    n: 2,
    names: ['Editor Video', 'Studio Edit'],
    summary: 'Penyuntingan video',
    modes: 'daring',
    price: [200000, 2000000, 'per proyek', 50000],
    keywords: ['edit video']
  },
  {
    slug: 'writing-translation',
    n: 2,
    names: ['Penulis', 'Penerjemah'],
    summary: 'Penulisan dan terjemahan',
    modes: 'daring',
    price: [100000, 1000000, 'per proyek', 50000],
    keywords: ['terjemah', 'copywriting']
  },
  {
    slug: 'bookkeeping',
    n: 2,
    names: ['Pembukuan Usaha', 'Jasa Pajak'],
    summary: 'Pencatatan keuangan dan pajak usaha kecil',
    modes: 'daring|panggilan',
    price: [300000, 2000000, 'per proyek', 50000],
    keywords: ['pembukuan', 'pajak umkm']
  },
  {
    slug: 'souvenir-food',
    n: 3,
    names: ['Oleh-oleh', 'Keripik Sanjai', 'Randang'],
    summary: 'Makanan dan oleh-oleh khas Sumbar',
    modes: 'di tempat',
    price: [15000, 150000, 'per item', 5000],
    keywords: ['oleh-oleh', 'keripik']
  },
  {
    slug: 'handicraft-textile',
    n: 3,
    names: ['Songket', 'Kerajinan', 'Tenun'],
    summary: 'Kerajinan tangan dan kain songket',
    modes: 'di tempat',
    price: [50000, 3000000, 'per item', 25000],
    keywords: ['songket', 'kerajinan']
  },
  {
    slug: 'fashion',
    n: 2,
    names: ['Butik', 'Fashion Muslim'],
    summary: 'Pakaian dan aksesori',
    modes: 'di tempat|daring',
    price: [75000, 800000, 'per item', 25000],
    keywords: ['fashion']
  },
  {
    slug: 'farm-produce',
    n: 2,
    names: ['Hasil Kebun', 'Tani Makmur'],
    summary: 'Hasil pertanian dan perkebunan',
    modes: 'di tempat',
    price: [10000, 100000, 'per item', 5000],
    keywords: ['hasil tani']
  }
];

const OWNERS = [
  'Uni Ani',
  'Uda Rizal',
  'Bundo Kanduang',
  'Rancak',
  'Sado',
  'Mandeh',
  'Nan Elok',
  'Minang Jaya',
  'Padang Mas',
  'Kampuang',
  'Ranah',
  'Cegak',
  'Sumber Rezeki',
  'Berkah',
  'Harapan',
  'Bukik Indah',
  'Singgalang',
  'Marapi',
  'Tigo Sarangkai',
  'Anak Nagari'
];
const STATUS = [
  'terbit',
  'terbit',
  'terbit',
  'terbit',
  'terbit',
  'terbit',
  'terbit',
  'terbit',
  'draf',
  'menunggu review'
];
const VERIFY = [
  'belum',
  'belum',
  'belum',
  'belum',
  'belum',
  'belum',
  'kontak dicek',
  'kontak dicek',
  'kontak dicek',
  'dicek langsung'
];

const HEADER = [
  'slug',
  'name',
  'category',
  'summary',
  'location',
  'lat',
  'lng',
  'service_modes',
  'areas',
  'whatsapp',
  'instagram',
  'price_min',
  'price_max',
  'price_unit',
  'keywords',
  'attributes',
  'status',
  'verification',
  'source_url',
  'kind',
  'service_radius_km',
  'point_public'
];
// Kategori Tempat (informasi saja, tidak bisa dipesan).
const PLACE_CATS = new Set([
  'restaurant',
  'lodging',
  'nature-tourism',
  'beach-tourism',
  'cultural-tourism',
  'culinary-tourism',
  'family-recreation',
  'pharmacy-24h',
  'emergency-room'
]);
const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const rows: string[][] = [];
let counter = 0;
for (const spec of SPECS) {
  const used = new Set<string>();
  for (let i = 0; i < spec.n; i++) {
    counter++;
    let name: string;
    do name = `${pick(spec.names)} ${pick(OWNERS)}`;
    while (used.has(name));
    used.add(name);
    const place = pickPlace();
    const modes = spec.modes;
    const city = CITY_OF(place.slug);
    const areas =
      modes.includes('panggilan') || modes.includes('daring')
        ? [
            ...new Set([
              city,
              ...(chance(0.3)
                ? [pick(['padang', 'bukittinggi', 'payakumbuh', 'kab-padang-pariaman'])]
                : [])
            ])
          ].join('|')
        : '';
    const hasContact = spec.contact !== false || chance(0.2);
    let pmin = '',
      pmax = '';
    if (spec.price) {
      const [lo, hi, , step = 1000] = spec.price;
      const a = between(lo, hi, step);
      const b = Math.min(hi, a + between(0, Math.max(step, (hi - lo) / 2), step));
      pmin = String(a);
      pmax = chance(0.7) ? String(b) : '';
    }
    rows.push([
      `dummy-${spec.slug}-${i + 1}`,
      `[DUMMY] ${name}`,
      spec.slug,
      spec.summary,
      place.slug,
      place.lat,
      place.lng,
      modes,
      areas,
      hasContact ? `6280000${String(counter).padStart(5, '0')}` : '',
      hasContact ? `@dummy_${spec.slug.replace(/-/g, '_')}_${i + 1}` : '',
      pmin,
      pmax,
      spec.price?.[2] ?? '',
      pick(spec.keywords) + (chance(0.5) ? `|${pick(spec.keywords)}` : ''),
      spec.attrs?.() ?? '',
      pick(STATUS),
      pick(VERIFY),
      'dummy',
      PLACE_CATS.has(spec.slug) ? 'tempat' : 'penyedia',
      '',
      ''
    ]);
  }
}

// ───── Tahap 1: penyedia di Kota Padang untuk empat pintu ─────
// Benih acak terpisah agar data dummy lama di atas tidak berubah (dipakai check:search).
// Titik diletakkan dekat pusat kecamatannya agar Mesin Lokasi bisa mencocokkannya dengan poligon.
let seed1 = 20261015;
const r1 = () => {
  seed1 = (seed1 + 0x6d2b79f5) | 0;
  let t = Math.imul(seed1 ^ (seed1 >>> 15), 1 | seed1);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const p1 = <T>(a: readonly T[]) => a[Math.floor(r1() * a.length)];
const b1 = (lo: number, hi: number, step = 1000) =>
  lo + Math.floor((r1() * (hi - lo + step)) / step) * step;
const c1 = (p: number) => r1() < p;
const yn = (p: number) => (c1(p) ? 'ya' : 'tidak');

// Perkiraan pusat kecamatan Kota Padang [lat, lng].
const PADANG: Record<string, [number, number]> = {
  'padang-barat': [-0.951, 100.356],
  'padang-timur': [-0.944, 100.379],
  'padang-utara': [-0.91, 100.355],
  'padang-selatan': [-0.975, 100.38],
  nanggalo: [-0.898, 100.37],
  kuranji: [-0.905, 100.415],
  'koto-tangah': [-0.825, 100.35],
  pauh: [-0.933, 100.44],
  'lubuk-begalung': [-0.97, 100.4],
  'lubuk-kilangan': [-0.96, 100.45],
  'bungus-teluk-kabung': [-1.05, 100.4]
};
const KEC = Object.keys(PADANG);
const SPORT_FAC = ['Kamar mandi', 'Tempat ganti', 'Parkir mobil', 'Musala', 'Kantin'];
const some = (a: string[], min = 1) => {
  const out = a.filter(() => c1(0.5));
  return (out.length >= min ? out : a.slice(0, min)).join(';');
};

type T1 = {
  slug: string;
  n: number;
  names: string[];
  summary: string;
  modes: string;
  price?: [number, number, string];
  keywords: string[];
  attrs: () => string;
  /** Rumahan/perorangan: titik privat, publik hanya melihat kecamatan. */
  privatePoint?: number;
  kind?: 'tempat';
};
const sport = (minDur = 60) =>
  `min_duration=${minDur}|cancel_before=${p1([120, 720, 1440])}|dp_required=${yn(0.4)}|facilities=${some(SPORT_FAC, 2)}`;
const T1_SPECS: T1[] = [
  // Ka main
  {
    slug: 'padel-court',
    n: 4,
    names: ['Padel', 'Padel Club', 'Arena Padel'],
    summary: 'Lapangan padel indoor, sewa per jam',
    modes: 'di tempat',
    price: [150000, 350000, 'per jam'],
    keywords: ['padel', 'lapangan padel'],
    attrs: () => {
      const racket = c1(0.4);
      return `min_duration=60|racket_included=${racket ? 'ya' : 'tidak'}${racket ? '' : `|racket_price=${b1(15000, 30000, 5000)}`}|cancel_before=${p1([720, 1440])}|dp_required=${yn(0.5)}|facilities=${some(SPORT_FAC, 2)}`;
    }
  },
  {
    slug: 'futsal-court',
    n: 3,
    names: ['Futsal', 'Arena Futsal', 'Lapangan Futsal'],
    summary: 'Lapangan futsal vinyl dan rumput sintetis',
    modes: 'di tempat',
    price: [80000, 150000, 'per jam'],
    keywords: ['futsal', 'lapangan futsal'],
    attrs: () => sport()
  },
  {
    slug: 'mini-soccer-field',
    n: 2,
    names: ['Mini Soccer', 'Lapangan Mini Soccer'],
    summary: 'Lapangan mini soccer rumput sintetis',
    modes: 'di tempat',
    price: [300000, 600000, 'per jam'],
    keywords: ['mini soccer', 'sepak bola mini'],
    attrs: () => sport(120)
  },
  {
    slug: 'badminton-court',
    n: 3,
    names: ['GOR Badminton', 'Badminton Hall', 'Lapangan Bulutangkis'],
    summary: 'Lapangan badminton karpet, sewa per jam',
    modes: 'di tempat',
    price: [40000, 70000, 'per jam'],
    keywords: ['badminton', 'bulutangkis'],
    attrs: () => sport()
  },
  {
    slug: 'billiard',
    n: 2,
    names: ['Billiard', 'Pool & Billiard'],
    summary: 'Meja billiard, buka sampai dini hari',
    modes: 'di tempat',
    price: [30000, 50000, 'per jam'],
    keywords: ['billiard', 'biliar'],
    attrs: () => `min_duration=60|cancel_before=120|dp_required=tidak`
  },
  {
    slug: 'karaoke',
    n: 2,
    names: ['Karaoke Keluarga', 'Family Karaoke'],
    summary: 'Ruang karaoke keluarga per jam',
    modes: 'di tempat',
    price: [60000, 150000, 'per jam'],
    keywords: ['karaoke', 'nyanyi'],
    attrs: () =>
      `room_capacity=${b1(6, 15, 1)}|min_duration=60|cancel_before=180|dp_required=${yn(0.3)}`
  },
  {
    slug: 'gym',
    n: 1,
    names: ['Fitness Center', 'Gym'],
    summary: 'Pusat kebugaran, kunjungan harian dan bulanan',
    modes: 'di tempat',
    price: [20000, 35000, 'per kunjungan'],
    keywords: ['gym', 'fitness'],
    attrs: () =>
      `day_pass_price=${b1(20000, 35000, 5000)}|monthly_price=${b1(150000, 300000, 25000)}|women_area=${yn(0.5)}`
  },
  // Ka rawat diri
  {
    slug: 'barbershop',
    n: 4,
    names: ['Barbershop', 'Barber', 'Pangkas Rambut'],
    summary: 'Potong rambut pria, cukur jenggot, cuci rambut',
    modes: 'di tempat',
    price: [25000, 60000, 'per orang'],
    keywords: ['barbershop', 'pangkas rambut', 'cukur'],
    attrs: () =>
      `haircut_duration=30|beard_duration=15|wash_duration=10|reservation=${p1(['Perlu reservasi', 'Bisa walk-in', 'Reservasi atau walk-in'])}|late_tolerance=10|cancel_before=60|accepts_children=${yn(0.8)}`
  },
  {
    slug: 'salon',
    n: 2,
    names: ['Salon', 'Salon Muslimah'],
    summary: 'Salon rambut dan perawatan',
    modes: 'di tempat',
    price: [35000, 150000, 'per orang'],
    keywords: ['salon', 'creambath'],
    attrs: () =>
      `treatments=${some(['Potong rambut', 'Creambath', 'Smoothing', 'Pewarnaan', 'Hair spa'], 2)}|women_only=${yn(0.5)}|cancel_before=120|dp_required=tidak`
  },
  {
    slug: 'spa-massage',
    n: 3,
    names: ['Spa', 'Pijat Keluarga', 'Urut Tradisional'],
    summary: 'Pijat dan spa, bisa dipanggil ke rumah',
    modes: 'di tempat|panggilan',
    price: [80000, 200000, 'per jam'],
    keywords: ['pijat', 'urut', 'spa'],
    attrs: () =>
      `home_service=ya|therapist_gender=${p1(['Pria', 'Wanita', 'Pria dan wanita'])}|min_duration=60|cancel_before=120`,
    privatePoint: 0.5
  },
  {
    slug: 'reflexology',
    n: 2,
    names: ['Refleksi', 'Refleksi Kaki'],
    summary: 'Pijat refleksi kaki dan badan',
    modes: 'di tempat',
    price: [60000, 120000, 'per jam'],
    keywords: ['refleksi'],
    attrs: () => `home_service=tidak|min_duration=60|cancel_before=60`
  },
  {
    slug: 'facial-skincare',
    n: 1,
    names: ['Klinik Kecantikan', 'Skin Care'],
    summary: 'Facial dan perawatan kulit',
    modes: 'di tempat',
    price: [100000, 350000, 'per orang'],
    keywords: ['facial', 'perawatan wajah'],
    attrs: () => `treatments=Facial, peeling, masker|cancel_before=1440|dp_required=ya`
  },
  // Ka uda anta
  {
    slug: 'intercity-travel',
    n: 5,
    names: ['Travel', 'Travel Express', 'Trans'],
    summary: 'Travel antarkota berizin, jemput di alamat',
    modes: 'panggilan',
    price: [80000, 150000, 'per orang'],
    keywords: ['travel', 'antar kota', 'pulang kampung'],
    attrs: () =>
      `pickup_type=${p1(['Jemput di alamat', 'Alamat atau titik kumpul'])}|vehicle_type=${p1(['Toyota Innova', 'Toyota Hiace', 'Mitsubishi Xpander'])}|max_luggage=1 koper dan 1 tas|accepts_parcels=${yn(0.7)}|cancel_before=180|permit_number=DUMMY-AJDP-${b1(100, 999, 1)}`
  },
  {
    slug: 'parcel-delivery',
    n: 2,
    names: ['Titip Paket', 'Kirim Barang'],
    summary: 'Titip paket ke kota-kota di Sumbar',
    modes: 'panggilan',
    price: [15000, 50000, 'per item'],
    keywords: ['titip paket', 'kirim barang'],
    attrs: () => `max_weight=${b1(10, 30, 5)}|same_day=${yn(0.6)}`
  },
  {
    slug: 'moving-transport',
    n: 2,
    names: ['Angkutan Pindahan', 'Pickup Pindahan'],
    summary: 'Angkut barang dan pindahan rumah dalam kota',
    modes: 'panggilan',
    price: [300000, 1500000, 'per kunjungan'],
    keywords: ['pindahan', 'angkut barang'],
    attrs: () => `vehicle=${p1(['Pickup', 'Engkel', 'Truk'])}|helpers_included=${yn(0.6)}`
  },
  // Ka servis
  {
    slug: 'ac-repair',
    n: 4,
    names: ['Servis AC', 'Teknik AC', 'Dingin AC'],
    summary: 'Cuci, servis, dan pasang AC, datang ke rumah',
    modes: 'panggilan',
    price: [75000, 150000, 'per kunjungan'],
    keywords: ['servis ac', 'cuci ac', 'ac tidak dingin'],
    attrs: () =>
      `brands=${c1(0.5) ? 'Semua merek' : some(['Daikin', 'Panasonic', 'LG', 'Sharp', 'Gree'], 2)}|visit_fee=${b1(30000, 75000, 5000)}|warranty=${p1([10080, 43200])}|after_hours=${yn(0.4)}`,
    privatePoint: 0.5
  },
  {
    slug: 'motorcycle-repair',
    n: 2,
    names: ['Bengkel Motor', 'Montir Panggilan'],
    summary: 'Servis motor di bengkel atau panggilan',
    modes: 'di tempat|panggilan',
    price: [50000, 200000, 'per kunjungan'],
    keywords: ['servis motor', 'bengkel onda'],
    attrs: () =>
      `visit_fee=${b1(20000, 50000, 5000)}|warranty=${p1([1440, 10080])}|after_hours=${yn(0.3)}`
  },
  {
    slug: 'electronics-repair',
    n: 2,
    names: ['Servis HP', 'Servis Elektronik'],
    summary: 'Servis HP, laptop, dan elektronik rumah',
    modes: 'di tempat',
    price: [50000, 500000, 'per kunjungan'],
    keywords: ['servis hp', 'servis laptop'],
    attrs: () => `visit_fee=0|warranty=${p1([10080, 43200])}|after_hours=tidak`
  },
  {
    slug: 'cleaning',
    n: 1,
    names: ['Jasa Bersih Rumah'],
    summary: 'Bersih-bersih rumah dan kantor, harian',
    modes: 'panggilan',
    price: [150000, 400000, 'per kunjungan'],
    keywords: ['bersih rumah', 'cleaning service'],
    attrs: () => `visit_fee=0|after_hours=tidak`
  },
  {
    slug: 'laundry',
    n: 2,
    names: ['Laundry', 'Laundry Kiloan'],
    summary: 'Cuci kiloan, antar jemput',
    modes: 'di tempat|panggilan',
    price: [7000, 12000, 'per item'],
    keywords: ['laundry', 'cuci baju'],
    attrs: () =>
      `price_per_kg=${b1(6000, 10000, 1000)}|pickup_delivery=${yn(0.7)}|turnaround=${p1([1440, 2880])}`
  },
  // Tempat (informasi saja)
  {
    slug: 'pharmacy-24h',
    n: 2,
    names: ['Apotek', 'Apotek Sehat'],
    summary: 'Apotek buka 24 jam',
    modes: 'di tempat',
    keywords: ['apotek', 'obat malam'],
    attrs: () => '',
    kind: 'tempat'
  },
  {
    slug: 'emergency-room',
    n: 2,
    names: ['RS', 'Rumah Sakit Umum'],
    summary: 'IGD 24 jam',
    modes: 'di tempat',
    keywords: ['igd', 'rumah sakit'],
    attrs: () => '',
    kind: 'tempat'
  }
];

let n1 = 0;
for (const spec of T1_SPECS) {
  const used = new Set<string>();
  for (let i = 0; i < spec.n; i++) {
    n1++;
    let name: string;
    do name = `${p1(spec.names)} ${p1(OWNERS)}`;
    while (used.has(name));
    used.add(name);
    const kec = p1(KEC);
    const [clat, clng] = PADANG[kec];
    const lat = (clat + (r1() - 0.5) * 0.008).toFixed(5);
    const lng = (clng + (r1() - 0.5) * 0.008).toFixed(5);
    const onCall = spec.modes.includes('panggilan');
    // Area layanan penyedia panggilan: beberapa kecamatan, seluruh kota, atau radius dari markas.
    const style = onCall ? p1(['kecamatan', 'kota', 'radius'] as const) : null;
    const areas =
      style === 'kecamatan'
        ? [...new Set([kec, ...KEC.filter(() => c1(0.25))])].join('|')
        : style === 'kota'
          ? 'padang'
          : '';
    const radius = style === 'radius' ? String(p1([5, 8, 12])) : '';
    let pmin = '',
      pmax = '';
    if (spec.price) {
      const [lo, hi] = spec.price;
      const a = b1(lo, hi, lo >= 100000 ? 10000 : 5000);
      pmin = String(a);
      pmax = String(Math.min(hi, a + b1(0, (hi - lo) / 2, lo >= 100000 ? 10000 : 5000)));
    }
    rows.push([
      `dummy-padang-${spec.slug}-${i + 1}`,
      `[DUMMY] ${name}`,
      spec.slug,
      spec.summary,
      kec,
      lat,
      lng,
      spec.modes,
      areas,
      `628001${String(n1).padStart(6, '0')}`,
      c1(0.6) ? `@dummy_padang_${spec.slug.replace(/-/g, '_')}_${i + 1}` : '',
      pmin,
      pmax,
      spec.price?.[2] ?? '',
      spec.keywords.join('|'),
      spec.attrs(),
      'terbit',
      // Sebagian besar kontak dicek agar bisa menerima pesanan (PRD 8.14); satu dari sepuluh belum.
      n1 % 10 === 7 ? 'belum' : c1(0.3) ? 'dicek langsung' : 'kontak dicek',
      'dummy',
      spec.kind ?? 'penyedia',
      radius,
      spec.privatePoint && c1(spec.privatePoint) ? 'tidak' : ''
    ]);
  }
}
const csv = [HEADER, ...rows].map((r) => r.map(q).join(',')).join('\n') + '\n';
writeFileSync(new URL('../../data/dummy-listings.csv', import.meta.url), csv);
console.log(`ditulis data/dummy-listings.csv: ${rows.length} listing dummy`);
