'use client';

// Formulir singkat satu kategori pintu + daftar hasil (PRD 9.1–9.3). Hasil, harga, dan slot dibuat server
// dari database (findProviders); pelonggaran hanya diterapkan bila warga menekannya.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icons } from '@/components/icons';
import { searchDoor } from '../api/search';
import type { LocChoice, ResultCard, SavedAddressOption, SearchResult } from '../api/types';
import { PERIODS } from '../lib/format';
import { loadDraft, loadLoc, saveDraft } from '../lib/store';
import { LocationPicker } from './location-picker';

type Kind = 'slot' | 'seat' | 'none';
type Props = {
  category: { id: number; name: string; kind: Kind };
  dates: { value: string; label: string }[];
  destinations: { id: number; name: string }[];
  saved: SavedAddressOption[] | null;
  askPeople: boolean;
  servis: boolean;
  chatHref: string;
};

export function DoorSearch({
  category,
  dates,
  destinations,
  saved,
  askPeople,
  servis,
  chatHref
}: Props) {
  const kind = category.kind;
  const [loc, setLoc] = useState<LocChoice | null>(null);
  const [date, setDate] = useState(dates[0].value);
  const [period, setPeriod] = useState<string>(kind === 'none' ? '' : 'semua');
  const [seats, setSeats] = useState(kind === 'seat' ? 1 : askPeople ? 2 : 1);
  const [destinationId, setDestinationId] = useState<number | null>(destinations[0]?.id ?? null);
  const [problem, setProblem] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [relax, setRelax] = useState<{ radius?: boolean; time?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);

  // Ingatan sesi dibaca setelah tampil (sessionStorage tidak ada di server).
  useEffect(() => {
    setLoc(loadLoc());
    const d = loadDraft();
    if (d.problem) setProblem(d.problem);
  }, []);

  async function run(r: typeof relax) {
    setError(null);
    if (kind === 'none' && problem.trim().length < 3)
      return setError('Ceritakan dulu kebutuhanmu, singkat saja.');
    if (kind === 'none' && !period) return setError('Pilih bagian hari.');
    if (kind !== 'slot' && !loc) return setError('Pilih lokasi dulu.');
    if (kind === 'none') saveDraft({ problem: problem.trim(), date, period });
    setBusy(true);
    setRelax(r);
    const res = await searchDoor({
      categoryId: category.id,
      loc,
      date,
      period: kind === 'none' ? 'semua' : period,
      seats,
      destinationId: kind === 'seat' ? destinationId : null,
      relax: r
    }).catch(() => ({
      ok: false as const,
      error: 'Gagal mencari. Periksa sambungan lalu coba lagi.'
    }));
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setResult(res);
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      resultsRef.current?.focus({ preventScroll: true });
    });
  }

  const periods = kind === 'none' ? PERIODS : [{ key: 'semua', label: 'Kapan saja' }, ...PERIODS];
  const locQuestion =
    kind === 'seat'
      ? 'Dijemput di mana?'
      : kind === 'none'
        ? servis
          ? 'Servisnya di mana?'
          : 'Di mana lokasinya?'
        : 'Lokasimu sekarang';

  return (
    <>
      <form
        className='w-box'
        onSubmit={(e) => {
          e.preventDefault();
          void run({});
        }}
      >
        {kind === 'none' && (
          <div className='w-field'>
            <label htmlFor='w-problem'>
              {servis ? 'Ceritakan keluhannya' : 'Ceritakan kebutuhannya'}
            </label>
            <textarea
              id='w-problem'
              aria-label={servis ? 'Ceritakan keluhannya' : 'Ceritakan kebutuhannya'}
              maxLength={500}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder={servis ? 'mis. AC tidak dingin dan menetes' : 'mis. kirim paket 5 kg'}
              required
            />
          </div>
        )}

        {kind === 'seat' && (
          <div className='w-field'>
            <label htmlFor='w-dest'>Kota tujuan (berangkat dari Padang)</label>
            {destinations.length ? (
              <select
                id='w-dest'
                aria-label='Kota tujuan (berangkat dari Padang)'
                value={destinationId ?? ''}
                onChange={(e) => setDestinationId(Number(e.target.value))}
              >
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className='w-muted'>Belum ada rute travel yang terdaftar.</p>
            )}
          </div>
        )}

        <div className='w-field'>
          <label htmlFor='w-date'>Tanggal</label>
          <select
            id='w-date'
            aria-label='Tanggal'
            value={date}
            onChange={(e) => setDate(e.target.value)}
          >
            {dates.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className='w-legend'>{kind === 'none' ? 'Bagian hari' : 'Jam'}</legend>
          <div className='w-chips'>
            {periods.map((p) => (
              <label key={p.key} className='w-chip'>
                <input
                  type='radio'
                  name='period'
                  aria-label={p.label}
                  value={p.key}
                  checked={period === p.key}
                  onChange={() => setPeriod(p.key)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>

        {(askPeople || kind === 'seat') && (
          <div className='w-field'>
            <label htmlFor='w-seats'>
              {kind === 'seat' ? 'Jumlah penumpang' : 'Berapa orang?'}
            </label>
            <input
              id='w-seats'
              aria-label={kind === 'seat' ? 'Jumlah penumpang' : 'Berapa orang?'}
              type='number'
              inputMode='numeric'
              min={1}
              max={kind === 'seat' ? 10 : 30}
              value={seats}
              onChange={(e) => setSeats(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <LocationPicker
            value={loc}
            onChange={setLoc}
            saved={saved}
            question={locQuestion}
            hint={
              kind === 'slot'
                ? 'Biar kami urutkan dari yang paling dekat. Boleh dilewati.'
                : 'Hanya kecamatan yang terlihat penyedia sebelum pesanan diterima.'
            }
          />
        </div>

        {error && (
          <p className='w-alert' role='alert'>
            {error}
          </p>
        )}
        <div className='w-actions'>
          <button className='w-btn block' type='submit' disabled={busy}>
            <Icons.search size={18} aria-hidden='true' />
            {busy ? 'Mencari…' : `Cari ${category.name.toLowerCase()}`}
          </button>
        </div>
      </form>

      {result?.ok && (
        <Results
          result={result}
          headingRef={resultsRef}
          onRelax={(key) => run({ ...relax, [key]: true })}
          busy={busy}
          chatHref={chatHref}
        />
      )}
    </>
  );
}

function Results({
  result,
  headingRef,
  onRelax,
  busy,
  chatHref
}: {
  result: Extract<SearchResult, { ok: true }>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onRelax: (key: 'radius' | 'time') => void;
  busy: boolean;
  chatHref: string;
}) {
  const { items, uncertain, relaxations, locationLabel } = result;
  return (
    <section className='w-section' aria-busy={busy}>
      <h2 className='w-h2' ref={headingRef} tabIndex={-1}>
        {items.length
          ? `${items.length} pilihan${locationLabel ? `, terdekat dari ${locationLabel}` : ''}`
          : 'Belum ada yang cocok'}
      </h2>
      {!items.length && (
        <p className='w-muted'>
          Tidak ada penyedia terverifikasi yang kosong dan melayani pilihanmu.{' '}
          {relaxations.length ? 'Coba longgarkan pencarian:' : 'Coba tanggal atau jam lain.'}
        </p>
      )}
      {relaxations.length > 0 && (
        <div className='w-box soft'>
          {items.length > 0 && <p>Hasilnya sedikit. Mau dilonggarkan?</p>}
          <div className='w-chips' style={{ marginTop: 8 }}>
            {relaxations.map((r) => (
              <button
                key={r.key}
                type='button'
                className='w-chip'
                disabled={busy}
                onClick={() => onRelax(r.key as 'radius' | 'time')}
              >
                {r.label} ({r.count} hasil)
              </button>
            ))}
          </div>
        </div>
      )}
      {items.length > 0 && (
        <ul className='w-results' style={{ marginTop: 12 }}>
          {items.map((c) => (
            <Card key={c.id} c={c} />
          ))}
        </ul>
      )}
      {uncertain.length > 0 && (
        <>
          <h2 className='w-h2'>Belum pasti</h2>
          <p className='w-muted'>
            Datanya belum lengkap, jadi belum bisa kami pastikan cocok. Tanyakan dulu ke
            penyedianya.
          </p>
          <ul className='w-results' style={{ marginTop: 12 }}>
            {uncertain.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </ul>
        </>
      )}
      <p className='w-muted' style={{ marginTop: 20 }}>
        Tidak menemukan yang pas? <Link href={chatHref}>Ceritakan di chat</Link>.
      </p>
    </section>
  );
}

function Card({ c }: { c: ResultCard }) {
  // Slot dikelompokkan per hari (pelonggaran jam bisa memuat dua hari).
  const days = [...new Set(c.slots.map((s) => s.day))];
  return (
    <li className='w-card'>
      <span className='w-card-cat'>{c.category}</span>
      <h3>
        <Link href={c.href}>{c.name}</Link>
      </h3>
      <div className='w-meta'>
        {c.place && <span>{c.place}</span>}
        {c.distance && (
          <span>
            <Icons.mapPin size={16} aria-hidden='true' />
            {c.distance}
          </span>
        )}
        <span>
          {c.verified && <Icons.badgeCheck size={16} aria-hidden='true' />}
          {c.verification}
        </span>
        {c.rating && (
          <span>
            <Icons.thumbUp size={16} aria-hidden='true' />
            {c.rating}
          </span>
        )}
      </div>
      {c.price && <p className='w-price'>{c.price}</p>}
      {c.missing.length > 0 && (
        <p className='w-muted' style={{ marginTop: 6 }}>
          Belum pasti: {c.missing.join(', ')}.
        </p>
      )}
      {!c.bookable ? (
        <p className='w-muted' style={{ marginTop: 8 }}>
          Belum bisa dipesan lewat Kamanga. <Link href={c.href}>Lihat profil</Link>
        </p>
      ) : c.bookHref ? (
        <Link className='w-btn' href={c.bookHref}>
          Pesan
        </Link>
      ) : (
        days.map((d) => (
          <div key={d}>
            {days.length > 1 && <p className='w-day'>{d}</p>}
            <ul className='w-slots' aria-label={`Slot kosong ${d}`}>
              {c.slots
                .filter((s) => s.day === d)
                .map((s) => (
                  <li key={s.href}>
                    <Link className='w-slot' href={s.href}>
                      <span className='sr-only'>Pesan {d}, </span>
                      <b>{s.time}</b>
                      {s.price && <small>{s.price}</small>}
                      {s.note && <small>{s.note}</small>}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </li>
  );
}
