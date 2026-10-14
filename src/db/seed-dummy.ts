// Memuat data/dummy-listings.csv lewat alur impor yang sama dengan panel admin (mode perbarui, aman diulang),
// lalu membuat unit dan jam buka untuk listing dummy yang kategorinya memakai Mesin Jadwal.
// Prasyarat: bun run db:seed-reference dan bun run auth:create-admin. Hapus semua dummy: bun run db:clear-dummy.
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { runListingImport } from '@/features/listings/api/repository';
import { db } from './index';
import { scheduleRules, units, user } from './schema';

const [admin] = await db.select({ id: user.id }).from(user).limit(1);
if (!admin) {
  console.error('Belum ada akun. Jalankan: bun run auth:create-admin');
  process.exit(1);
}
const csv = readFileSync(new URL('../../data/dummy-listings.csv', import.meta.url), 'utf8');
const r = await runListingImport(admin.id, csv, 'upsert');
if (!r.ok) {
  console.error('Gagal:', r.message, r.errors.slice(0, 10));
  process.exit(1);
}
console.log(`dummy    : ${r.created} baru, ${r.updated} diperbarui`);

// ───── Unit dan jam buka (hanya untuk listing dummy yang belum punya unit) ─────
type Interval = [start: string, end: string]; // end <= start = lewat tengah malam
type Plan = {
  unitNames: string[];
  slotMinutes: number;
  /** Jam buka per hari, 0 = Minggu … 6 = Sabtu. */
  hours: (weekday: number) => Interval[];
  peak?: Interval;
};
const every = (iv: Interval[]) => () => iv;
// Jumat: istirahat salat Jumat (contoh beberapa interval dalam sehari).
const fridayBreak = (open: string, close: string) => (d: number) =>
  d === 5
    ? ([
        [open, '11:45'],
        ['13:30', close]
      ] as Interval[])
    : ([[open, close]] as Interval[]);

const n = (base: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${base} ${i + 1}`);

const PLANS: Record<string, (i: number) => Plan> = {
  'padel-court': (i) => ({
    unitNames: n('Lapangan Padel', 1 + (i % 3)),
    slotMinutes: 60,
    hours: every([['07:00', '23:00']]),
    peak: ['17:00', '22:00']
  }),
  'futsal-court': (i) => ({
    unitNames: n('Lapangan', 2 + (i % 2)),
    slotMinutes: 60,
    // Satu tempat buka sampai jam 1 dini hari (interval lewat tengah malam).
    hours: every([['08:00', i % 2 ? '01:00' : '23:00']]),
    peak: ['18:00', '22:00']
  }),
  'mini-soccer-field': () => ({
    unitNames: ['Lapangan Utama'],
    slotMinutes: 60,
    hours: every([['07:00', '22:00']]),
    peak: ['16:00', '21:00']
  }),
  'badminton-court': (i) => ({
    unitNames: n('Lapangan', 2 + (i % 3)),
    slotMinutes: 60,
    hours: every([['08:00', '22:00']]),
    peak: ['18:00', '21:00']
  }),
  'sport-venue': () => ({
    unitNames: ['Lapangan 1'],
    slotMinutes: 60,
    hours: every([['08:00', '22:00']])
  }),
  billiard: () => ({
    unitNames: n('Meja', 4),
    slotMinutes: 60,
    hours: every([['10:00', '02:00']]),
    peak: ['19:00', '23:00']
  }),
  karaoke: () => ({
    unitNames: ['Ruang A', 'Ruang B', 'Ruang C'],
    slotMinutes: 60,
    hours: every([['12:00', '00:00']]),
    peak: ['19:00', '23:00']
  }),
  barbershop: (i) => ({
    unitNames: ['Kursi A', 'Kursi B', 'Kursi C'].slice(0, 1 + (i % 3)),
    slotMinutes: 30,
    hours: fridayBreak('09:00', '21:00')
  }),
  salon: () => ({
    unitNames: n('Kursi', 2),
    slotMinutes: 60,
    hours: (d) => (d === 1 ? [] : [['09:00', '18:00']]) // Senin tutup
  }),
  'spa-massage': (i) => ({
    unitNames: n('Terapis', 1 + (i % 3)),
    slotMinutes: 60,
    hours: every([['10:00', '21:00']])
  }),
  reflexology: () => ({
    unitNames: n('Kursi refleksi', 3),
    slotMinutes: 60,
    hours: every([['10:00', '22:00']])
  }),
  'facial-skincare': () => ({
    unitNames: ['Ruang 1'],
    slotMinutes: 60,
    hours: (d) => (d === 0 ? [] : [['10:00', '19:00']]) // Minggu tutup
  })
};

// Travel: satu unit per rute (kapasitas = kursi), satu aturan per jam keberangkatan.
const ROUTES = ['bukittinggi', 'payakumbuh', 'solok', 'padang-panjang', 'pariaman'];
const DEPARTURES = ['06:30', '09:00', '13:00', '16:00', '19:00'];
const TRIP_MINUTES: Record<string, number> = {
  bukittinggi: 150,
  payakumbuh: 210,
  solok: 120,
  'padang-panjang': 90,
  pariaman: 75
};

const pending = (
  await db.execute(sql`
    select l.id, l.slug, l.price_min, l.price_max, c.slug as category, c.schedule_kind
    from listings l
    join listing_categories lc on lc.listing_id = l.id and lc.is_primary
    join categories c on c.id = lc.category_id
    where l.slug like 'dummy-%' and c.schedule_kind in ('slot', 'seat')
      and not exists (select 1 from units u where u.listing_id = l.id)
    order by l.id`)
).rows as {
  id: number;
  slug: string;
  price_min: number | null;
  price_max: number | null;
  category: string;
  schedule_kind: 'slot' | 'seat';
}[];

const locId = new Map(
  (
    (await db.execute(sql`select id, slug from locations where level = 'city'`)).rows as {
      id: number;
      slug: string;
    }[]
  ).map((l) => [l.slug, l.id])
);
const addMinutes = (t: string, mins: number) => {
  const [h, m] = t.split(':').map(Number);
  const total = (h * 60 + m + mins) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

let unitCount = 0;
let ruleCount = 0;
for (const [i, l] of pending.entries()) {
  const price = l.price_min ?? null;
  const peakPrice = l.price_max && l.price_min && l.price_max > l.price_min ? l.price_max : null;

  if (l.schedule_kind === 'seat') {
    // 1–2 rute per travel, berganti-ganti tujuan.
    const routes = ROUTES.filter((_, k) => (k + i) % 3 !== 0).slice(0, 1 + (i % 2));
    for (const [k, dest] of routes.entries()) {
      const [u] = await db
        .insert(units)
        .values({
          listingId: l.id,
          name: `Padang → ${dest.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
          capacity: i % 2 ? 10 : 7,
          originLocationId: locId.get('padang') ?? null,
          destinationLocationId: locId.get(dest) ?? null,
          sortOrder: k
        })
        .returning({ id: units.id });
      unitCount++;
      const rules = Array.from({ length: 7 }, (_, weekday) =>
        DEPARTURES.filter((_, d) => (d + k) % 2 === 0 || weekday === 5 || weekday === 0).map(
          (start) => ({
            unitId: u.id,
            weekday,
            startTime: start,
            endTime: addMinutes(start, TRIP_MINUTES[dest]),
            slotMinutes: TRIP_MINUTES[dest],
            price
          })
        )
      ).flat();
      await db.insert(scheduleRules).values(rules);
      ruleCount += rules.length;
    }
    continue;
  }

  const plan = PLANS[l.category]?.(i);
  if (!plan) continue;
  for (const [k, name] of plan.unitNames.entries()) {
    const [u] = await db
      .insert(units)
      .values({ listingId: l.id, name, sortOrder: k })
      .returning({ id: units.id });
    unitCount++;
    const rules = Array.from({ length: 7 }, (_, weekday) =>
      plan.hours(weekday).map(([startTime, endTime]) => ({
        unitId: u.id,
        weekday,
        startTime,
        endTime,
        slotMinutes: plan.slotMinutes,
        price,
        peakPrice: plan.peak ? peakPrice : null,
        peakStart: plan.peak && peakPrice ? plan.peak[0] : null,
        peakEnd: plan.peak && peakPrice ? plan.peak[1] : null
      }))
    ).flat();
    if (rules.length) await db.insert(scheduleRules).values(rules);
    ruleCount += rules.length;
  }
}
console.log(`jadwal   : ${unitCount} unit baru, ${ruleCount} aturan jam buka`);
process.exit(0);
