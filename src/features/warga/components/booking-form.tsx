'use client';

// Formulir pesan (PRD 8.5, 8.8): ringkasan, aturan penting yang wajib disetujui, lalu kirim.
// Tautan Terima/Tolak penyedia tidak pernah sampai ke sini (rencana keputusan 8).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icons } from '@/components/icons';
import type { RulesSnapshot, ScheduleKind } from '@/lib/engines/contracts';
import { createBookingAction } from '../api/service';
import type { LocChoice, SavedAddressOption } from '../api/types';
import { PERIODS } from '../lib/format';
import { loadDraft, loadLoc, saveDraft } from '../lib/store';
import { LocationPicker } from './location-picker';

export type DurationOption = { endsAt: string; minutes: number; label: string };

type Props = {
  slug: string;
  kind: ScheduleKind;
  item: string | null;
  slot: { unitId: number; startsAt: string; seats: number } | null;
  durations: DurationOption[];
  /** Akhir slot yang dipilih di halaman sebelumnya. */
  defaultEndsAt: string;
  rules: { lines: string[]; snapshot: RulesSnapshot };
  racket: string | null;
  signedIn: boolean;
  signInHref: string;
  saved: SavedAddressOption[] | null;
  dates: { value: string; label: string }[];
  servis: boolean;
};

export function BookingForm(p: Props) {
  const router = useRouter();
  const needsAddress = p.kind !== 'slot';
  const [endsAt, setEndsAt] = useState(p.defaultEndsAt);
  const [problem, setProblem] = useState('');
  const [date, setDate] = useState(p.dates[0].value);
  const [period, setPeriod] = useState('');
  const [loc, setLoc] = useState<LocChoice | null>(null);
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [racket, setRacket] = useState(false);
  const [agree, setAgree] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; retry?: string } | null>(null);

  // Isian dari halaman pintu / sebelum masuk dibaca dari sessionStorage setelah tampil.
  useEffect(() => {
    const d = loadDraft();
    setLoc(loadLoc());
    if (d.problem) setProblem(d.problem);
    if (d.date && p.dates.some((x) => x.value === d.date)) setDate(d.date);
    if (d.period && PERIODS.some((x) => x.key === d.period)) setPeriod(d.period);
    if (d.address) setAddress(d.address);
    if (d.note) setNote(d.note);
    setReady(true);
  }, [p.dates]);
  useEffect(() => {
    if (ready) saveDraft({ problem, date, period, address, note });
  }, [ready, problem, date, period, address, note]);

  function pickLoc(v: LocChoice | null) {
    setLoc(v);
    // Alamat tersimpan: isi alamat lengkapnya sekalian.
    const a = v?.source === 'saved' ? p.saved?.find((s) => s.id === v.addressId) : null;
    if (a && !address) setAddress(a.address);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agree) return setError({ text: 'Centang persetujuan aturan dulu.' });
    setBusy(true);
    const res = await createBookingAction({
      slug: p.slug,
      slot: p.slot ? { ...p.slot, endsAt } : null,
      request: p.kind === 'none' ? { problem, preferredDate: date, period } : null,
      loc,
      address,
      note,
      racket,
      rules: p.rules.snapshot
    }).catch(() => ({
      ok: false as const,
      error: 'Gagal mengirim. Periksa sambungan lalu coba lagi.'
    }));
    if (res.ok) {
      saveDraft({ problem: '', address: '', note: '' });
      router.push(res.href);
      return;
    }
    setBusy(false);
    setError({ text: res.error, retry: 'retryHref' in res ? res.retryHref : undefined });
  }

  return (
    <form onSubmit={submit}>
      {p.item && (
        <div className='w-box'>
          <p className='w-legend'>{p.item}</p>
          {p.durations.length > 1 ? (
            <div className='w-field'>
              <label htmlFor='w-dur'>Lama</label>
              <select
                id='w-dur'
                aria-label='Lama'
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              >
                {p.durations.map((d) => (
                  <option key={d.endsAt} value={d.endsAt}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p style={{ marginTop: 4 }}>{p.durations[0]?.label}</p>
          )}
          {p.racket && (
            <label className='w-check'>
              <input
                type='checkbox'
                aria-label='Sewa raket'
                checked={racket}
                onChange={(e) => setRacket(e.target.checked)}
              />
              <span>Sewa raket ({p.racket}, dibayar di tempat)</span>
            </label>
          )}
        </div>
      )}

      {p.kind === 'none' && (
        <div className='w-box'>
          <div className='w-field' style={{ marginTop: 0 }}>
            <label htmlFor='w-problem'>
              {p.servis ? 'Ceritakan keluhannya' : 'Ceritakan kebutuhannya'}
            </label>
            <textarea
              id='w-problem'
              aria-label={p.servis ? 'Ceritakan keluhannya' : 'Ceritakan kebutuhannya'}
              required
              minLength={3}
              maxLength={500}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
            />
            <small>
              Jangan tulis nomor HP di sini. Nomor dibuka ke penyedia setelah pesanan diterima.
            </small>
          </div>
          <div className='w-field'>
            <label htmlFor='w-date'>Tanggal yang diinginkan</label>
            <select
              id='w-date'
              aria-label='Tanggal yang diinginkan'
              value={date}
              onChange={(e) => setDate(e.target.value)}
            >
              {p.dates.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className='w-legend'>Bagian hari</legend>
            <div className='w-chips'>
              {PERIODS.map((x) => (
                <label key={x.key} className='w-chip'>
                  <input
                    type='radio'
                    name='period'
                    aria-label={x.label}
                    required
                    value={x.key}
                    checked={period === x.key}
                    onChange={() => setPeriod(x.key)}
                  />
                  {x.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      <div className='w-box'>
        <LocationPicker
          value={loc}
          onChange={pickLoc}
          saved={p.saved}
          question={
            p.kind === 'seat'
              ? 'Dijemput di mana?'
              : p.kind === 'none'
                ? p.servis
                  ? 'Servisnya di mana?'
                  : 'Di mana lokasinya?'
                : 'Lokasimu (opsional)'
          }
          hint='Sebelum pesanan diterima, penyedia hanya melihat kecamatannya.'
        />
        {needsAddress && (
          <>
            <div className='w-field'>
              <label htmlFor='w-address'>Alamat lengkap</label>
              <textarea
                id='w-address'
                aria-label='Alamat lengkap'
                required
                minLength={5}
                maxLength={300}
                value={address}
                autoComplete='street-address'
                onChange={(e) => setAddress(e.target.value)}
                placeholder='Jalan, nomor rumah, RT/RW'
              />
              <small>Dibuka ke penyedia hanya setelah pesanan diterima.</small>
            </div>
            <div className='w-field'>
              <label htmlFor='w-note'>Patokan (opsional)</label>
              <input
                id='w-note'
                aria-label='Patokan (opsional)'
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder='mis. pagar hijau dekat musala'
              />
            </div>
          </>
        )}
      </div>

      <section className='w-rules' aria-labelledby='w-rules-h'>
        <h2 id='w-rules-h'>Aturan penting dari penyedia</h2>
        {p.rules.lines.length ? (
          <ul>
            {p.rules.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        ) : (
          <p style={{ marginTop: 6 }}>Penyedia belum menulis aturan khusus.</p>
        )}
        <label className='w-check'>
          <input
            type='checkbox'
            aria-label='Saya sudah membaca dan setuju dengan aturan di atas'
            required
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <span>Saya sudah membaca dan setuju dengan aturan di atas.</span>
        </label>
      </section>

      {error && (
        <p className='w-alert' role='alert'>
          {error.text} {error.retry && <Link href={error.retry}>Pilih jadwal lain</Link>}
        </p>
      )}
      <div className='w-actions'>
        {p.signedIn ? (
          <button className='w-btn block' type='submit' disabled={busy}>
            <Icons.send size={18} aria-hidden='true' />
            {busy ? 'Mengirim…' : 'Kirim pesanan'}
          </button>
        ) : (
          <>
            <Link className='w-btn block' href={p.signInHref}>
              <Icons.whatsapp size={18} aria-hidden='true' />
              Masuk dengan nomor WhatsApp
            </Link>
            <p className='w-muted'>
              Untuk mengirim pesanan, masuk dulu dengan kode dari WhatsApp. Isianmu tetap tersimpan.
            </p>
          </>
        )}
        <p className='w-muted'>Gratis selama masa perintisan. Pembayaran langsung ke penyedia.</p>
      </div>
    </form>
  );
}
