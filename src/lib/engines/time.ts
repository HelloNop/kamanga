// Waktu Kamanga selalu Asia/Jakarta (WIB, UTC+7, tanpa musim panas). Database menyimpan timestamptz;
// jam dinding (aturan jadwal, tanggal pengecualian) dibaca sebagai WIB.

export const TZ = 'Asia/Jakarta';
const OFFSET_MS = 7 * 60 * 60 * 1000;

/** "2026-10-18" + "19:00" (WIB) -> Date. Jam boleh "19:00" atau "19:00:00". */
export const fromJakarta = (date: string, hhmm: string) =>
  new Date(`${date}T${hhmm.length === 5 ? `${hhmm}:00` : hhmm}+07:00`);

/** Tanggal WIB "YYYY-MM-DD" dari sebuah Date. */
export const jakartaDate = (d: Date) =>
  new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);

/** Jam WIB "HH:MM" dari sebuah Date. */
export const jakartaTime = (d: Date) =>
  new Date(d.getTime() + OFFSET_MS).toISOString().slice(11, 16);

/** Hari WIB: 0 = Minggu … 6 = Sabtu (sama dengan schedule_rules.weekday). */
export const jakartaWeekday = (d: Date) => new Date(d.getTime() + OFFSET_MS).getUTCDay();

/** "YYYY-MM-DD" ditambah n hari. */
export const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const dayFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'short'
});

/** "Sabtu, 18 Okt". */
export const formatDay = (d: Date) => dayFmt.format(d).replace('.', '');

/** "19.00". */
export const formatClock = (d: Date) => jakartaTime(d).replace(':', '.');

/** "Sabtu, 18 Okt · 19.00–20.00" (seperti contoh pesan WA di Lampiran C PRD). */
export const formatSlot = (start: Date, end: Date) =>
  `${formatDay(start)} · ${formatClock(start)}–${formatClock(end)}`;
