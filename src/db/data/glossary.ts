// Kamus istilah awal. SEMUA perlu dicek penutur asli sebelum dianggap benar (lihat kolom catatan).
// `target` menunjuk ke kategori, kebutuhan, atau lokasi (boleh kosong).
type Target = { category?: string; need?: string; location?: string };
export const GLOSSARY: { term: string; meaning: string; target?: Target }[] = [
  { term: 'onda', meaning: 'sepeda motor', target: { category: 'motorcycle-repair' } },
  { term: 'oto', meaning: 'mobil', target: { category: 'car-repair' } },
  { term: 'lapau', meaning: 'warung atau kedai', target: { category: 'restaurant' } },
  { term: 'kadai', meaning: 'toko atau warung', target: { category: 'restaurant' } },
  { term: 'baralek', meaning: 'pesta pernikahan', target: { need: 'wedding-event' } },
  { term: 'anak daro', meaning: 'pengantin perempuan', target: { need: 'wedding-event' } },
  { term: 'marapulai', meaning: 'pengantin laki-laki', target: { need: 'wedding-event' } },
  {
    term: 'pelaminan',
    meaning: 'tempat duduk pengantin beserta dekorasinya',
    target: { category: 'wedding-decoration' }
  },
  {
    term: 'orgen tunggal',
    meaning: 'hiburan musik dengan organ tunggal',
    target: { category: 'live-music' }
  },
  { term: 'randang', meaning: 'rendang', target: { category: 'souvenir-food' } },
  {
    term: 'sanjai',
    meaning: 'keripik singkong balado khas Bukittinggi',
    target: { category: 'souvenir-food' }
  },
  {
    term: 'songket',
    meaning: 'kain tenun bersulam benang emas atau perak',
    target: { category: 'handicraft-textile' }
  },
  { term: 'bajalan', meaning: 'bepergian atau jalan-jalan', target: { need: 'weekend-trip' } },
  // Sinonim umum (bukan istilah Minang), supaya kalimat sehari-hari ikut dikenali. Perlu dicek.
  { term: 'tenda', meaning: 'tenda untuk acara', target: { category: 'tent-rental' } },
  { term: 'sewa tenda', meaning: 'sewa tenda untuk acara', target: { category: 'tent-rental' } },
  { term: 'hp', meaning: 'telepon genggam', target: { category: 'electronics-repair' } },
  { term: 'laptop', meaning: 'komputer jinjing', target: { category: 'electronics-repair' } },
  { term: 'website', meaning: 'situs web', target: { category: 'web-development' } },
  { term: 'toko online', meaning: 'toko daring', target: { category: 'web-development' } },
  { term: 'gedung', meaning: 'gedung atau aula untuk acara', target: { category: 'event-venue' } },
  { term: 'aula', meaning: 'gedung atau aula untuk acara', target: { category: 'event-venue' } },
  { term: 'ac', meaning: 'pendingin ruangan', target: { category: 'ac-repair' } },
  { term: 'liburan', meaning: 'wisata atau bepergian', target: { need: 'weekend-trip' } },
  { term: 'piknik', meaning: 'wisata atau bepergian', target: { need: 'weekend-trip' } },
  { term: 'jalan jalan', meaning: 'wisata atau bepergian', target: { need: 'weekend-trip' } },
  { term: 'weekend', meaning: 'akhir pekan', target: { need: 'weekend-trip' } },
  { term: 'foto', meaning: 'jasa fotografi', target: { category: 'photography' } },
  { term: 'fotografer', meaning: 'jasa fotografi', target: { category: 'photography' } },
  { term: 'rias', meaning: 'rias pengantin atau acara', target: { category: 'makeup-artist' } },
  { term: 'mua', meaning: 'penata rias', target: { category: 'makeup-artist' } },
  { term: 'hotel', meaning: 'penginapan', target: { category: 'lodging' } },
  { term: 'penginapan', meaning: 'tempat menginap', target: { category: 'lodging' } },
  { term: 'homestay', meaning: 'penginapan rumahan', target: { category: 'lodging' } },
  {
    term: 'les privat',
    meaning: 'belajar tambahan dengan guru privat',
    target: { category: 'tutor' }
  },
  { term: 'montir', meaning: 'tukang servis kendaraan', target: { need: 'vehicle-trouble' } },
  { term: 'bengkel', meaning: 'tempat servis kendaraan', target: { need: 'vehicle-trouble' } },
  { term: 'lubeg', meaning: 'Lubuk Begalung', target: { location: 'lubuk-begalung' } }
];
