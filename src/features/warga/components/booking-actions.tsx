'use client';

// Aksi warga di halaman pesanan: batal, ulasan "Puas?", dan muat ulang otomatis selama menunggu jawaban.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cancelBookingAction, submitReviewAction } from '../api/service';

/** Muat ulang data halaman tiap 30 detik (status berubah saat penyedia menjawab). */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

export function CancelBooking({ id, rules }: { id: number; rules: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open)
    return (
      <button type='button' className='w-btn ghost block' onClick={() => setOpen(true)}>
        Batalkan pesanan
      </button>
    );
  return (
    <form
      className='w-box'
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await cancelBookingAction(id, reason);
        setBusy(false);
        if (r.ok) return router.refresh();
        setError(
          r.tooLate
            ? `Batas waktu pembatalan sudah lewat. ${rules ?? ''} Hubungi penyedia langsung bila perlu.`
            : r.error
        );
      }}
    >
      <div className='w-field' style={{ marginTop: 0 }}>
        <label htmlFor='w-cancel'>Alasan (opsional)</label>
        <input
          id='w-cancel'
          aria-label='Alasan (opsional)'
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='mis. jadwal berubah'
        />
      </div>
      {error && (
        <p className='w-alert' role='alert'>
          {error}
        </p>
      )}
      <div className='w-actions'>
        <button className='w-btn block' type='submit' disabled={busy}>
          {busy ? 'Membatalkan…' : 'Ya, batalkan'}
        </button>
        <button type='button' className='w-btn ghost block' onClick={() => setOpen(false)}>
          Tidak jadi
        </button>
      </div>
    </form>
  );
}

export function ReviewForm({ id }: { id: number }) {
  const router = useRouter();
  const [satisfied, setSatisfied] = useState<boolean | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className='w-box'
      onSubmit={async (e) => {
        e.preventDefault();
        if (satisfied === null) return setError('Pilih Puas atau Kurang puas.');
        setBusy(true);
        setError(null);
        const r = await submitReviewAction(id, {
          satisfied,
          stars,
          comment: comment.trim() || null
        });
        setBusy(false);
        if (r.ok) router.refresh();
        else setError(r.error);
      }}
    >
      <fieldset style={{ marginTop: 0 }}>
        <legend className='w-legend'>Puas?</legend>
        <div className='w-chips'>
          {[
            { v: true, label: 'Puas' },
            { v: false, label: 'Kurang puas' }
          ].map((o) => (
            <label key={o.label} className='w-chip'>
              <input
                type='radio'
                name='satisfied'
                aria-label={o.label}
                checked={satisfied === o.v}
                onChange={() => setSatisfied(o.v)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className='w-legend'>Bintang (opsional)</legend>
        <div className='w-stars'>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className='w-chip'>
              <input
                type='radio'
                name='stars'
                aria-label={`${n} bintang`}
                checked={stars === n}
                onChange={() => setStars(n)}
              />
              {n}
              <span className='sr-only'> bintang</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className='w-field'>
        <label htmlFor='w-comment'>Cerita singkat (opsional)</label>
        <textarea
          id='w-comment'
          aria-label='Cerita singkat (opsional)'
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      {error && (
        <p className='w-alert' role='alert'>
          {error}
        </p>
      )}
      <div className='w-actions'>
        <button className='w-btn block' type='submit' disabled={busy}>
          {busy ? 'Mengirim…' : 'Kirim ulasan'}
        </button>
      </div>
    </form>
  );
}
