// Balasan yang disusun kode (tanpa model AI): gratis, cepat, dan isinya pasti sesuai data.
// Gaya: Indonesia santai dengan sedikit sentuhan Minang. PERLU DICEK penutur asli (kata: ado, nan, alun, paliang, rancak, sakitar).
import type { Outcome } from './search-tool';
import type { Chip, Reply } from './types';

const pick = <T>(options: T[], seed: number) => options[Math.abs(seed) % options.length];
const join = (a: string[]) =>
  a.length <= 1
    ? (a[0] ?? '')
    : a.length === 2
      ? `${a[0]} dan ${a[1]}`
      : `${a.slice(0, -1).join(', ')}, dan ${a.at(-1)}`;

export const greeting = (seed: number, chips: string[]): Reply => ({
  text: pick(
    [
      'Halo, Uda/Uni! Saya Kamanga. Mau main, rawat diri, berangkat, servis, atau cari tempat? Ketik saja kebutuhannya.',
      'Assalamualaikum, Uda/Uni! Kamanga di siko. Ka manga hari ko?'
    ],
    seed
  ),
  chips
});

export const thanks = (seed: number): Reply => ({
  text: pick(
    [
      'Samo-samo, Uda/Uni! Kalau ado nan lain, tanyo sajo.',
      'Sama-sama! Semoga lancar urusannya. Kalau butuh yang lain, kabari saja.'
    ],
    seed
  )
});

export const menu = (chips: string[]): Reply => ({
  text: 'Kamanga bisa carikan lapangan dan tempat main, barber dan pijat, travel dan antar barang, servis AC, motor, dan tukang, lengkap dengan jadwal yang masih kosong. Ketik saja, misalnya "padel nanti malam di Lubeg" atau "servis AC di Kuranji".',
  chips
});

/** Di luar layanan atau upaya mengubah aturan: ditolak sopan tanpa memanggil model AI. */
export const outOfScope = (chips: string[]): Reply => ({
  text: 'Maaf, yang itu di luar layanan Kamanga. Kamanga membantu urusan sehari-hari: main, rawat diri, berangkat, servis, dan mencari tempat. Mau dicarikan apa?',
  chips
});

const LOCATION_CHIPS: Chip[] = [
  { label: 'Pakai lokasi saya', kind: 'location', action: { kind: 'location' } },
  { label: 'Ketik daerah', kind: 'type' }
];

/** Satu pertanyaan lokasi dengan alasannya (PRD 8.15). Izin browser baru diminta setelah tombol ditekan. */
export const askLocation = (): Reply => ({
  text: 'Biar ambo carikan yang paling dekat, boleh pakai lokasi Uda/Uni? Atau ketik nama daerahnya.',
  chips: LOCATION_CHIPS
});

export const unknownLocation = (said: string, chips: string[]): Reply => ({
  text: `Maaf, "${said.slice(0, 60)}" belum saya kenali sebagai lokasi di Sumatera Barat. Kamanga baru melayani Sumatera Barat. Coba sebut kecamatan atau kota, misalnya Padang, Bukittinggi, atau Lubeg.`,
  chips
});

export const outsideService = (): Reply => ({
  text: 'Lokasi itu belum masuk wilayah layanan Kamanga. Untuk sekarang pemesanan baru ada di Kota Padang. Ketik nama daerah di Padang, ya.',
  chips: [{ label: 'Ketik daerah', kind: 'type' }]
});

export const askWhen = (travel: boolean): Reply => ({
  text: travel ? 'Berangkat kapan, Uda/Uni?' : 'Untuk kapan, Uda/Uni?',
  chips: travel
    ? ['Besok pagi', 'Besok siang', 'Besok sore', 'Besok malam']
    : ['Nanti malam', 'Besok pagi', 'Besok sore', 'Besok malam', 'Kapan saja']
});

export const askPeople = (): Reply => ({
  text: 'Berapa orang yang berangkat?',
  chips: ['1 orang', '2 orang', '3 orang', '4 orang']
});

export const askDestination = (destinations: string[]): Reply => ({
  text: 'Mau ke mana, Uda/Uni?',
  chips: destinations.map((d) => `ke ${d}`)
});

const DOOR_QUESTION: Record<string, string> = {
  'ka-main': 'Mau main apa, Uda/Uni?',
  'ka-rawat-diri': 'Mau perawatan apa?',
  'ka-uda-anta': 'Mau berangkat atau mengantar barang?',
  'ka-servis': 'Apa yang mau diservis?'
};

/** Pintu dikenali tetapi jenisnya belum: tanya jenisnya dengan tombol kategori yang punya penyedia. */
export const askDoorCategory = (
  door: { slug: string; name: string },
  options: { id: number; name: string }[]
): Reply => ({
  text: `${door.name}, siap. ${DOOR_QUESTION[door.slug] ?? 'Mau yang mana?'}`,
  chips: options.map((o) => ({ label: o.name, action: { kind: 'category', id: o.id } }))
});

export const forwardOffer = (): Reply => ({
  text: 'Belum ada info soal itu. Mau ditanyakan ke pengelolanya?',
  chips: [
    { label: 'Ya, tanyakan', action: { kind: 'forward', yes: true } },
    { label: 'Tidak usah', action: { kind: 'forward', yes: false } }
  ]
});

export const forwardCancelled = (): Reply => ({
  text: 'Baik, tidak jadi ditanyakan. Ada lagi yang mau dicari?'
});

/** Pertanyaan aturan tanpa memilih penyedia: tanya tempat yang mana (satu pertanyaan). */
export const whichListing = (shown: { slug: string; name: string }[]): Reply => ({
  text: 'Untuk tempat yang mana, Uda/Uni?',
  chips: shown.map((l) => ({ label: l.name, action: { kind: 'focus', slug: l.slug } }))
});

export const askCategory = (
  locationName: string,
  available: string[],
  needChips: string[]
): Reply =>
  available.length
    ? {
        text: `Siap, ${locationName}. Di sana ado ${join(available)}. Uda/Uni butuh yang mana, atau cari yang lain?`,
        chips: available.map((a) => `${a} di ${locationName}`)
      }
    : {
        text: `Siap, ${locationName}. Uda/Uni butuh apa di sana? Tulis saja kebutuhannya, misalnya "servis AC" atau "katering".`,
        chips: needChips
      };

export const chooseLocation = (
  candidates: { id?: number; name: string; parentName: string | null }[]
): Reply => ({
  text: `Nama itu ada lebih dari satu tempat. Maksud Uda/Uni yang mana?`,
  chips: candidates.map((c) => {
    const label = c.parentName ? `${c.name} (${c.parentName})` : c.name;
    return c.id ? { label, action: { kind: 'region' as const, id: c.id } } : label;
  })
});

export const unclear = (chips: string[]): Reply => ({
  text: 'Maaf, Kamanga alun paham maksudnya. Coba tulis kebutuhan, waktu, dan daerahnya, misalnya "padel nanti malam di Lubeg" atau "servis AC di Kuranji".',
  chips
});

export const limitReached = (): Reply => ({
  text: 'Pesan untuk hari ini sudah mencapai batas. Silakan coba lagi besok, ya, Uda/Uni.'
});
/** Rem harian model AI tercapai. Pencarian lewat jalur kode tetap jalan. */
export const aiResting = (chips: string[]): Reply => ({
  text: 'Asisten AI Kamanga sedang istirahat untuk hari ini. Pencarian biasa tetap bisa: tulis kebutuhan dan daerahnya, misalnya "servis AC di Lubeg".',
  chips
});
/** Terlalu banyak yang sedang dilayani model AI: antrean penuh atau menunggu terlalu lama. */
export const crowded = (): Reply => ({
  text: 'Kamanga lagi ramai sekali. Coba kirim lagi sebentar lagi, ya.'
});
export const busy = (): Reply => ({
  text: 'Maaf, Kamanga lagi sibuk. Coba lagi sebentar lagi, ya.'
});

/** Balasan setelah pencarian. `ctx.budget` dan `ctx.capacity` hanya untuk disebut ulang. */
export function fromOutcome(
  o: Outcome,
  seed: number,
  ctx: { budgetText?: string; capacityText?: string } = {}
): Reply {
  if (o.status === 'need_location_choice') return chooseLocation(o.candidates);
  if (o.status === 'location_not_found') return unknownLocation(o.text, []);
  if (o.status === 'no_category') return unclear([]);

  const what = o.categories.length ? join(o.categories.slice(0, 2)).toLowerCase() : 'usaha';
  const where =
    o.location && o.location.level !== 'province'
      ? ` di ${o.location.name}`
      : o.location
        ? ' di Sumatera Barat'
        : '';
  const extras = [ctx.capacityText, ctx.budgetText].filter(Boolean).join(', ');
  const tail = extras ? `, ${extras}` : '';

  // Ajakan lanjut dari saran perluasan; hanya yang bisa dipahami lagi oleh router.
  const first = o.categories[0] ?? 'jasa';
  const chips: string[] = [];
  for (const a of o.alternatives) {
    if (a.label.includes('seluruh Sumatera Barat')) chips.push(`${first} di Sumbar`);
    else if ((a.label.includes('anggaran') || a.label.includes('atribut')) && o.location)
      chips.push(`${first} di ${o.location.name}`);
  }
  const uniqueChips = [...new Set(chips)];

  if (o.total === 0) {
    return {
      text:
        pick(
          [
            `Maaf, alun ado ${what}${where}${tail} nan terdaftar di Kamanga.`,
            `Maaf, belum ada ${what}${where}${tail} yang terdaftar di Kamanga.`
          ],
          seed
        ) + (uniqueChips.length ? ' Mau dicoba dengan syarat yang lebih longgar?' : ''),
      chips: uniqueChips
    };
  }
  const shown = o.items.length;
  const intro = pick(
    [
      `Ado ${o.total} ${what}${where}${tail} nan cocok. Ini ${shown} nan paliang rancak:`,
      `Ada ${o.total} ${what}${where}${tail} yang cocok. Ini ${shown} teratas:`
    ],
    seed
  );
  return {
    text: `${intro}\nHubungi langsung lewat WhatsApp untuk memastikan ketersediaan dan harganya, ya.`,
    chips: uniqueChips,
    listings: { items: o.items, total: o.total }
  };
}
