'use client';

// Akun warga: alamat tersimpan, keluar, dan hapus akun beserta datanya (PRD 8.7, 8.15).
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icons } from '@/components/icons';
import { authClient } from '@/lib/auth-client';
import { addSavedAddress, deleteAccount, deleteSavedAddress } from '../api/service';
import type { LocChoice } from '../api/types';
import { LocationPicker } from './location-picker';

type Address = {
  id: number;
  label: string;
  address: string;
  place: string | null;
  hasPoint: boolean;
};

export function SavedAddresses({ items }: { items: Address[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('Rumah');
  const [address, setAddress] = useState('');
  const [loc, setLoc] = useState<LocChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: number) {
    setBusy(true);
    const r = await deleteSavedAddress(id);
    setBusy(false);
    if (r.ok) router.refresh();
    else setError(r.error);
  }

  return (
    <>
      {items.length ? (
        <ul className='w-list'>
          {items.map((a) => (
            <li key={a.id} className='w-box' style={{ marginTop: 0 }}>
              <div className='w-row' style={{ justifyContent: 'space-between' }}>
                <b>{a.label}</b>
                <button
                  type='button'
                  className='w-link'
                  disabled={busy}
                  onClick={() => remove(a.id)}
                  aria-label={`Hapus alamat ${a.label}`}
                >
                  Hapus
                </button>
              </div>
              <p>{a.address}</p>
              <p className='w-muted'>
                {[a.place, a.hasPoint ? 'dengan titik lokasi' : 'tanpa titik lokasi']
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className='w-muted'>Belum ada alamat tersimpan.</p>
      )}

      {adding ? (
        <form
          className='w-box'
          onSubmit={async (e) => {
            e.preventDefault();
            if (!loc) return setError('Pilih lokasinya dulu.');
            setBusy(true);
            setError(null);
            const r = await addSavedAddress({ label, address, loc });
            setBusy(false);
            if (!r.ok) return setError(r.error);
            setAdding(false);
            setAddress('');
            setLoc(null);
            router.refresh();
          }}
        >
          <div className='w-field' style={{ marginTop: 0 }}>
            <label htmlFor='w-label'>Nama alamat</label>
            <input
              id='w-label'
              aria-label='Nama alamat'
              required
              maxLength={30}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='mis. Rumah, Kantor'
            />
          </div>
          <div className='w-field'>
            <label htmlFor='w-addr'>Alamat lengkap</label>
            <textarea
              id='w-addr'
              aria-label='Alamat lengkap'
              required
              minLength={5}
              maxLength={300}
              autoComplete='street-address'
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <LocationPicker
              value={loc}
              onChange={setLoc}
              saved={null}
              question='Di mana letaknya?'
              hint='Bila memakai lokasi saya, titiknya ikut disimpan untuk alamat ini (atas pilihanmu).'
            />
          </div>
          {error && (
            <p className='w-alert' role='alert'>
              {error}
            </p>
          )}
          <div className='w-actions'>
            <button className='w-btn block' type='submit' disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan alamat'}
            </button>
            <button type='button' className='w-btn ghost block' onClick={() => setAdding(false)}>
              Batal
            </button>
          </div>
        </form>
      ) : (
        <div className='w-actions'>
          <button type='button' className='w-btn ghost block' onClick={() => setAdding(true)}>
            <Icons.add size={18} aria-hidden='true' />
            Tambah alamat
          </button>
        </div>
      )}
      {!adding && error && (
        <p className='w-alert' role='alert'>
          {error}
        </p>
      )}
    </>
  );
}

export function SignOut() {
  return (
    <button
      type='button'
      className='w-btn ghost block'
      onClick={async () => {
        await authClient.signOut();
        window.location.assign('/'); // navigasi penuh: sesi baru saja berakhir
      }}
    >
      <Icons.logout size={18} aria-hidden='true' />
      Keluar
    </button>
  );
}

/** Hapus akun: dua langkah (buka konfirmasi, lalu ketik HAPUS). */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open)
    return (
      <button type='button' className='w-link' onClick={() => setOpen(true)}>
        Hapus akun dan data saya
      </button>
    );
  return (
    <form
      className='w-box'
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await deleteAccount(text.trim());
        if (!r.ok) {
          setBusy(false);
          return setError(r.error);
        }
        window.location.assign('/'); // navigasi penuh: sesi baru saja berakhir
      }}
    >
      <p>
        Nomor, nama, alamat tersimpan, dan kontak di pesananmu akan dihapus permanen. Pesanan yang
        masih aktif dibatalkan. Riwayat pesanan dan ulasan tetap ada tanpa identitasmu.
      </p>
      <div className='w-field'>
        <label htmlFor='w-confirm'>Ketik HAPUS untuk memastikan</label>
        <input
          id='w-confirm'
          aria-label='Ketik HAPUS untuk memastikan'
          autoComplete='off'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {error && (
        <p className='w-alert' role='alert'>
          {error}
        </p>
      )}
      <div className='w-actions'>
        <button className='w-btn block' type='submit' disabled={busy || text.trim() !== 'HAPUS'}>
          {busy ? 'Menghapus…' : 'Hapus akun permanen'}
        </button>
        <button type='button' className='w-btn ghost block' onClick={() => setOpen(false)}>
          Tidak jadi
        </button>
      </div>
    </form>
  );
}
