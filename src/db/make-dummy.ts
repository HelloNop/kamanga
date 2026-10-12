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
  'source_url'
];
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
      'dummy'
    ]);
  }
}
// Pastikan keywords tanpa duplikat sederhana
const csv = [HEADER, ...rows].map((r) => r.map(q).join(',')).join('\n') + '\n';
writeFileSync(new URL('../../data/dummy-listings.csv', import.meta.url), csv);
console.log(`ditulis data/dummy-listings.csv: ${rows.length} listing dummy`);
