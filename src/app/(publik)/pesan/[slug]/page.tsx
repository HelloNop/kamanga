// Mulai memesan satu penyedia (PRD 8.5, 8.8, 9.1–9.3): ringkasan + aturan penting yang harus disetujui,
// masuk OTP bila perlu, lalu kirim. Tanpa slot di query (kategori ber-jadwal) → pemilih slot listing ini.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icons } from '@/components/icons';
import { parseAttributeSchema, formatDuration } from '@/features/listings/lib/format';
import {
  getBookingTarget,
  getCitizenProfile,
  listSavedAddresses
} from '@/features/warga/api/repository';
import { BookingForm, type DurationOption } from '@/features/warga/components/booking-form';
import { WargaHeader } from '@/features/warga/components/header';
import { buildRules, nextDays, rupiah } from '@/features/warga/lib/format';
import { slotButtons } from '@/features/warga/lib/slots';
import { paths, schedule, type Slot } from '@/lib/engines/contracts';
import { addDays, formatClock, formatDay, fromJakarta } from '@/lib/engines/time';
import { getSession } from '@/lib/session';

type Query = { unit?: string; mulai?: string; selesai?: string; kursi?: string; tanggal?: string };
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Query> };

export const metadata: Metadata = { title: 'Pesan' };

const HOUR = 3_600_000;
const date = (s?: string) => {
  const d = s ? new Date(s) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/** Slot kosong berurutan mulai dari `start` di satu unit → pilihan lama (1–4 slot), minimal sesuai aturan. */
function durations(slots: Slot[], start: Date, minMinutes?: number): DurationOption[] {
  const first = slots.findIndex((s) => s.startsAt.getTime() === start.getTime());
  if (first < 0) return [];
  const chain = [slots[first]];
  for (const s of slots.slice(first + 1)) {
    if (chain.length === 4 || s.startsAt.getTime() !== chain.at(-1)!.endsAt.getTime()) break;
    chain.push(s);
  }
  return chain
    .map((_, i) => {
      const part = chain.slice(0, i + 1);
      const end = part.at(-1)!.endsAt;
      const minutes = (end.getTime() - start.getTime()) / 60_000;
      const price = part.every((p) => p.price !== null)
        ? part.reduce((n, p) => n + p.price!, 0)
        : null;
      return {
        endsAt: end.toISOString(),
        minutes,
        label: `${formatDuration(minutes)} · ${formatClock(start)}–${formatClock(end)}${price === null ? '' : ` · ${rupiah(price)}`}`
      };
    })
    .filter((o) => !minMinutes || o.minutes >= minMinutes);
}

export default async function BookPage({ params, searchParams }: Props) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const t = await getBookingTarget(slug);
  if (!t) notFound();
  const { listing, category } = t;
  const back = (
    <Link className='w-back' href={paths.listing(listing.slug)}>
      <Icons.chevronLeft size={18} aria-hidden='true' />
      {listing.name}
    </Link>
  );

  if (!t.bookable || !category)
    return (
      <div className='warga'>
        <WargaHeader />
        <main className='w-main'>
          {back}
          <h1 className='w-title'>Belum bisa dipesan</h1>
          <p className='w-alert info'>
            {listing.name} belum bisa dipesan lewat Kamanga
            {listing.verification === 'unverified' ? ' karena belum diverifikasi tim kami' : ''}.
            Lihat <Link href={paths.listing(listing.slug)}>profilnya</Link> untuk informasi lain.
          </p>
        </main>
      </div>
    );

  const kind = category.scheduleKind;
  const rules = buildRules(parseAttributeSchema(category.attributeSchema), listing.attributes);
  const session = await getSession();
  const citizen = session?.user.role === 'citizen' ? session : null;
  const profile = citizen ? await getCitizenProfile(citizen.user.id) : null;
  const saved = citizen
    ? (await listSavedAddresses(citizen.user.id)).map((a) => ({
        id: a.id,
        label: a.label,
        address: a.address
      }))
    : null;
  const qs = new URLSearchParams(
    Object.entries(q).filter((e): e is [string, string] => typeof e[1] === 'string')
  ).toString();
  const here = `/pesan/${listing.slug}${qs ? `?${qs}` : ''}`;
  const seats = Math.min(Math.max(Number(q.kursi) || 1, 1), 50);

  // Slot dari query (dari halaman pintu / profil) diperiksa ulang ke mesin Jadwal.
  let slot: { unitId: number; startsAt: string; seats: number } | null = null;
  let options: DurationOption[] = [];
  let endsAt = '';
  let item: string | null = null;
  let gone = false;
  const unit = t.units.find((u) => u.id === Number(q.unit));
  const start = date(q.mulai);
  if (kind !== 'none' && unit && start) {
    const free = await schedule.getAvailability({
      unitIds: [unit.id],
      from: start,
      to: new Date(start.getTime() + (kind === 'seat' ? 60_000 : 6 * HOUR)),
      seats
    });
    if (kind === 'seat') {
      const s = free.find((x) => x.startsAt.getTime() === start.getTime());
      if (s)
        options = [
          {
            endsAt: s.endsAt.toISOString(),
            minutes: 0,
            label: `Berangkat ${formatClock(start)} · ${seats} kursi${s.price === null ? '' : ` · ${rupiah(s.price * seats)}`}`
          }
        ];
    } else options = durations(free, start, rules.snapshot.minMinutes);
    if (options.length) {
      slot = { unitId: unit.id, startsAt: start.toISOString(), seats };
      item = `${unit.name} · ${formatDay(start)}${kind === 'slot' && seats > 1 ? ` · ${seats} orang` : ''}`;
      const wanted = date(q.selesai)?.toISOString();
      endsAt = options.find((o) => o.endsAt === wanted)?.endsAt ?? options[0].endsAt;
    } else gone = true;
  }

  // Pemilih slot untuk kategori ber-jadwal tanpa slot terpilih.
  const days = nextDays(7);
  const day = days.some((d) => d.value === q.tanggal) ? q.tanggal! : days[0].value;
  let picker: ReturnType<typeof slotButtons> | null = null;
  if (kind !== 'none' && !slot) {
    const free = t.units.length
      ? await schedule.getAvailability({
          unitIds: t.units.map((u) => u.id),
          from: fromJakarta(day, '00:00'),
          to: fromJakarta(addDays(day, 1), '00:00'),
          seats
        })
      : [];
    picker = slotButtons(listing.slug, free, new Map(t.units.map((u) => [u.id, u.name])), {
      seat: kind === 'seat',
      seats,
      max: 40
    });
  }

  const racket =
    listing.attributes.racket_included === false &&
    typeof listing.attributes.racket_price === 'number'
      ? rupiah(listing.attributes.racket_price)
      : null;

  return (
    <div className='warga'>
      <WargaHeader />
      <main className='w-main'>
        {back}
        <p className='w-card-cat'>{category.name}</p>
        <h1 className='w-title'>Pesan {listing.name}</h1>
        {listing.locationName && <p className='w-lead'>{listing.locationName}</p>}

        {picker ? (
          <section className='w-section'>
            {gone && (
              <p className='w-alert' role='alert'>
                Jadwal yang kamu pilih sudah tidak tersedia. Pilih jadwal lain.
              </p>
            )}
            <h2 className='w-h2'>Pilih jadwal</h2>
            <nav className='w-chips' aria-label='Tanggal'>
              {days.map((d, i) => (
                <Link
                  key={d.value}
                  className='w-chip'
                  aria-current={d.value === day ? 'page' : undefined}
                  href={`/pesan/${listing.slug}?tanggal=${d.value}${seats > 1 ? `&kursi=${seats}` : ''}`}
                  replace
                  scroll={false}
                >
                  {i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : d.label}
                </Link>
              ))}
            </nav>
            {picker.length ? (
              <ul className='w-slots'>
                {picker.map((s) => (
                  <li key={s.href}>
                    <Link className='w-slot' href={s.href}>
                      <b>{s.time}</b>
                      {s.price && <small>{s.price}</small>}
                      {s.note && <small>{s.note}</small>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className='w-muted' style={{ marginTop: 12 }}>
                Tidak ada jadwal kosong pada {days.find((d) => d.value === day)?.label}. Coba
                tanggal lain.
              </p>
            )}
          </section>
        ) : (
          <BookingForm
            slug={listing.slug}
            kind={kind}
            item={item}
            slot={slot}
            durations={options}
            defaultEndsAt={endsAt}
            rules={rules}
            racket={racket}
            signedIn={!!citizen && !!profile?.privacyConsentAt}
            signInHref={paths.citizenSignIn(here)}
            saved={saved}
            dates={nextDays(14)}
            servis={category.doorSlug === 'ka-servis'}
          />
        )}
      </main>
    </div>
  );
}
