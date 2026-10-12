// Balasan yang disusun kode (tanpa model AI): gratis, cepat, dan isinya pasti sesuai data.
// Gaya: Indonesia santai dengan sedikit sentuhan Minang. PERLU DICEK penutur asli (kata: ado, nan, alun, paliang, rancak, sakitar).
import type { Outcome } from './search-tool';
import type { Reply } from './types';

const pick = <T>(options: T[], seed: number) => options[Math.abs(seed) % options.length];
const join = (a: string[]) =>
  a.length <= 1
    ? (a[0] ?? '')
    : a.length === 2
      ? `${a[0]} dan ${a[1]}`
      : `${a.slice(0, -1).join(', ')}, dan ${a.at(-1)}`;

export const greeting = (seed: number, needChips: string[]): Reply => ({
  text: pick(
    [
      'Halo, Uda/Uni! Saya Kamanga, bisa bantu cari jasa, tempat, wisata, atau usaha lokal di Sumatera Barat. Mau cari apa hari ini?',
      'Assalamualaikum, Uda/Uni! Kamanga di siko. Cari jasa atau tempat apa di Sumatera Barat?'
    ],
    seed
  ),
  chips: needChips
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

export const menu = (needChips: string[]): Reply => ({
  text: 'Saya bisa carikan jasa (servis, tukang, katering, dan lain-lain), tempat (gedung, penginapan, rumah makan), wisata, freelancer, dan produk UMKM di Sumatera Barat. Sebut kebutuhan dan lokasinya, misalnya "servis AC di Lubeg".',
  chips: needChips
});

export const askLocation = (categories: string[], chips: string[]): Reply => ({
  text: `Untuk ${categories.length > 2 ? `${categories.slice(0, 2).join(', ')}, dan lainnya` : join(categories)}, di mana lokasinya, Uda/Uni? Sebut kecamatan atau kotanya.`,
  chips
});

export const unknownLocation = (said: string, chips: string[]): Reply => ({
  text: `Maaf, "${said.slice(0, 60)}" belum saya kenali sebagai lokasi di Sumatera Barat. Kamanga baru melayani Sumatera Barat. Coba sebut kecamatan atau kota, misalnya Padang, Bukittinggi, atau Lubeg.`,
  chips
});

/**
 * Warga hanya menyebut tempat. `available` = kategori yang sudah ada di tempat itu; bila ada, ditawarkan
 * sebagai pilihan (data nyata, bukan pertanyaan kosong). Bila tidak ada, minta kebutuhannya dengan contoh.
 */
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
  candidates: { name: string; parentName: string | null }[]
): Reply => ({
  text: `Nama itu ada lebih dari satu tempat. Maksud Uda/Uni yang mana?`,
  chips: candidates.map((c) => (c.parentName ? `${c.name} (${c.parentName})` : c.name))
});

export const unclear = (needChips: string[]): Reply => ({
  text: 'Maaf, Kamanga alun paham maksudnya. Coba tulis jenis jasa atau tempat dan lokasinya, misalnya "servis AC di Lubeg" atau "gedung untuk 300 orang di Padang".',
  chips: needChips
});

export const limitReached = (): Reply => ({
  text: 'Pesan untuk hari ini sudah mencapai batas. Silakan coba lagi besok, ya, Uda/Uni.'
});
/** Rem harian model AI tercapai. Pencarian lewat jalur kode tetap jalan. */
export const aiResting = (needChips: string[]): Reply => ({
  text: 'Asisten AI Kamanga sedang istirahat untuk hari ini. Pencarian biasa tetap bisa: tulis jenis jasa atau tempat dan lokasinya, misalnya "servis AC di Lubeg".',
  chips: needChips
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
