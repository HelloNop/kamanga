'use client';

// Lokasi warga (PRD 8.15): izin lokasi peramban diminta HANYA setelah tombol "Pakai lokasi saya" ditekan.
// Ditolak / tanpa GPS / di luar wilayah → ketik nama daerah. Pilihan diingat di sessionStorage, bukan di server.
import { useState } from 'react';
import { Icons } from '@/components/icons';
import { resolveDevicePoint, resolvePlace } from '../api/search';
import type { LocChoice, SavedAddressOption } from '../api/types';
import { saveLoc } from '../lib/store';

type Props = {
  value: LocChoice | null;
  onChange: (v: LocChoice | null) => void;
  /** Alamat tersimpan warga yang sedang masuk (null = tamu). */
  saved: SavedAddressOption[] | null;
  question: string;
  hint?: string;
};

export function LocationPicker({ value, onChange, saved, question, hint }: Props) {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'gps' | 'text' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [options, setOptions] = useState<{ regionId: number; label: string }[]>([]);

  const pick = (v: LocChoice | null) => {
    saveLoc(v);
    onChange(v);
    setMsg(null);
    setOptions([]);
    setTyping(false);
  };

  function useDevice() {
    if (!('geolocation' in navigator)) {
      setTyping(true);
      setMsg('Perangkat ini tidak bisa membaca lokasi. Ketik nama daerahnya saja.');
      return;
    }
    setBusy('gps');
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const r = await resolveDevicePoint(point).catch(() => null);
        setBusy(null);
        if (r?.ok) pick({ source: 'device', point, label: r.label });
        else {
          setTyping(true);
          setMsg(r?.error ?? 'Lokasi belum terbaca. Ketik nama daerahnya saja.');
        }
      },
      (err) => {
        setBusy(null);
        setTyping(true);
        setMsg(
          err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Tidak apa-apa, ketik nama daerahnya saja.'
            : 'Lokasi belum terbaca. Ketik nama daerahnya saja.'
        );
      },
      { timeout: 15000, maximumAge: 60000 }
    );
  }

  async function findPlace() {
    if (text.trim().length < 2) return setMsg('Ketik nama kecamatan atau kelurahan.');
    setBusy('text');
    setMsg(null);
    setOptions([]);
    const r = await resolvePlace(text).catch(() => null);
    setBusy(null);
    if (!r) setMsg('Gagal mencari daerah. Coba lagi.');
    else if (r.kind === 'resolved') pick({ source: 'place', regionId: r.regionId, label: r.label });
    else if (r.kind === 'ambiguous') {
      setOptions(r.options);
      setMsg('Yang mana maksudnya?');
    } else
      setMsg(
        `Daerah "${text.trim()}" belum kami kenal. Coba nama kecamatan atau kelurahan di Padang.`
      );
  }

  return (
    <fieldset>
      <legend className='w-legend'>{question}</legend>
      {hint && <p className='w-muted'>{hint}</p>}
      {value ? (
        <div className='w-loc' style={{ marginTop: 8 }}>
          <span>
            <Icons.mapPin size={18} aria-hidden='true' style={{ verticalAlign: '-3px' }} /> Lokasi:{' '}
            <b>{value.label}</b>
          </span>
          <button type='button' className='w-link' onClick={() => pick(null)}>
            Ganti
          </button>
        </div>
      ) : (
        <>
          <div className='w-chips' style={{ marginTop: 8 }}>
            <button type='button' className='w-chip' onClick={useDevice} disabled={!!busy}>
              <Icons.currentLocation size={18} aria-hidden='true' />
              {busy === 'gps' ? 'Membaca lokasi…' : 'Pakai lokasi saya'}
            </button>
            {!typing && (
              <button type='button' className='w-chip' onClick={() => setTyping(true)}>
                Ketik daerah
              </button>
            )}
            {saved?.map((a) => (
              <button
                key={a.id}
                type='button'
                className='w-chip'
                onClick={() => pick({ source: 'saved', addressId: a.id, label: a.label })}
              >
                <Icons.home size={18} aria-hidden='true' />
                {a.label}
              </button>
            ))}
          </div>
          {typing && (
            <div className='w-field'>
              <label htmlFor='w-daerah'>Nama daerah</label>
              <div className='w-row'>
                <input
                  id='w-daerah'
                  aria-label='Nama daerah'
                  className='w-input'
                  style={{ flex: 1, minWidth: 0 }}
                  value={text}
                  maxLength={80}
                  placeholder='mis. Lubeg, Kuranji, Koto Baru'
                  autoComplete='off'
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void findPlace();
                    }
                  }}
                />
                <button
                  type='button'
                  className='w-btn small dark'
                  onClick={findPlace}
                  disabled={!!busy}
                >
                  {busy === 'text' ? 'Mencari…' : 'Cari'}
                </button>
              </div>
            </div>
          )}
          {options.length > 0 && (
            <div className='w-chips' style={{ marginTop: 8 }}>
              {options.map((o) => (
                <button
                  key={o.regionId}
                  type='button'
                  className='w-chip'
                  onClick={() => pick({ source: 'place', regionId: o.regionId, label: o.label })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <p role='status' aria-live='polite' className={msg ? 'w-alert info' : 'sr-only'}>
        {msg}
      </p>
    </fieldset>
  );
}
