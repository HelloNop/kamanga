'use client';

// Masuk warga (PRD 8.7): nomor WA → kode OTP (dikirim Mesin Notifikasi lewat POST /api/wa/otp) →
// authClient.phoneNumber.verify membuat akun + sesi → akun baru: nama panggilan + persetujuan privasi.
import { useState } from 'react';
import { Icons } from '@/components/icons';
import { authClient } from '@/lib/auth-client';
import { citizenStatus, completeProfile } from '../api/service';

type Step = 'phone' | 'code' | 'profile';

export function SignIn({
  next,
  devHint,
  initialStep = 'phone'
}: {
  next: string;
  devHint: boolean;
  initialStep?: Step;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Navigasi penuh: sesi baru saja dibuat, dan router.refresh() tepat setelah router.replace()
  // bisa membatalkan perpindahan halaman.
  const done = () => window.location.assign(next);

  async function requestCode() {
    setBusy(true);
    setError(null);
    type OtpReply = { ok: boolean; phone?: string; error?: string };
    const res: OtpReply = await fetch('/api/wa/otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: phoneInput })
    })
      .then((r) => r.json() as Promise<OtpReply>)
      .catch(() => ({
        ok: false,
        error: 'Gagal mengirim kode. Periksa sambungan lalu coba lagi.'
      }));
    setBusy(false);
    if (!res.ok || !res.phone) return setError(res.error ?? 'Gagal mengirim kode.');
    setPhone(res.phone);
    setCode('');
    setStep('code');
    setInfo('Kode 6 angka sudah dikirim ke WhatsApp-mu. Berlaku 5 menit.');
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.phoneNumber.verify({ phoneNumber: phone, code });
    if (err) {
      setBusy(false);
      return setError(
        err.status === 403
          ? 'Terlalu banyak percobaan. Minta kode baru.'
          : 'Kode salah atau sudah kedaluwarsa. Periksa lagi, atau minta kode baru.'
      );
    }
    const s = await citizenStatus();
    setBusy(false);
    if (!s.ok) return setError(s.error);
    if (s.needsProfile) {
      setInfo(null);
      setStep('profile');
    } else done();
  }

  async function saveProfile() {
    setBusy(true);
    setError(null);
    const r = await completeProfile({ name, consent });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    done();
  }

  return (
    <form
      className='w-box'
      onSubmit={(e) => {
        e.preventDefault();
        void (step === 'phone' ? requestCode() : step === 'code' ? verify() : saveProfile());
      }}
    >
      {step === 'phone' && (
        <>
          <div className='w-field' style={{ marginTop: 0 }}>
            <label htmlFor='w-phone'>Nomor WhatsApp</label>
            <input
              id='w-phone'
              aria-label='Nomor WhatsApp'
              type='tel'
              inputMode='tel'
              autoComplete='tel'
              required
              placeholder='0812 3456 7890'
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
            <small>Kami kirim kode masuk ke nomor ini lewat WhatsApp.</small>
          </div>
          <div className='w-actions'>
            <button className='w-btn block' type='submit' disabled={busy}>
              <Icons.whatsapp size={18} aria-hidden='true' />
              {busy ? 'Mengirim kode…' : 'Kirim kode'}
            </button>
          </div>
        </>
      )}

      {step === 'code' && (
        <>
          <div className='w-field' style={{ marginTop: 0 }}>
            <label htmlFor='w-code'>Kode dari WhatsApp</label>
            <input
              id='w-code'
              aria-label='Kode dari WhatsApp'
              inputMode='numeric'
              autoComplete='one-time-code'
              pattern='\d{6}'
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              style={{ letterSpacing: '0.4em', fontSize: '1.3rem' }}
            />
          </div>
          <div className='w-actions'>
            <button className='w-btn block' type='submit' disabled={busy || code.length !== 6}>
              {busy ? 'Memeriksa…' : 'Masuk'}
            </button>
            <div className='w-row'>
              <button type='button' className='w-link' onClick={requestCode} disabled={busy}>
                Kirim ulang kode
              </button>
              <button
                type='button'
                className='w-link'
                onClick={() => {
                  setStep('phone');
                  setInfo(null);
                  setError(null);
                }}
              >
                Ganti nomor
              </button>
            </div>
          </div>
        </>
      )}

      {step === 'profile' && (
        <>
          <div className='w-field' style={{ marginTop: 0 }}>
            <label htmlFor='w-name'>Nama panggilan</label>
            <input
              id='w-name'
              aria-label='Nama panggilan'
              autoComplete='name'
              required
              minLength={2}
              maxLength={40}
              placeholder='mis. Uda Rizal'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <small>Nama ini dilihat penyedia setelah pesananmu diterima.</small>
          </div>
          <section className='w-rules' aria-labelledby='w-privasi'>
            <h2 id='w-privasi'>Privasi kamu</h2>
            <ul>
              <li>
                Kami menyimpan nomor WhatsApp, nama panggilan, pesanan dan ulasanmu, serta alamat
                yang kamu simpan sendiri.
              </li>
              <li>
                Nomor dan alamat lengkapmu baru dibuka ke penyedia setelah penyedia menerima
                pesanan. Sebelumnya penyedia hanya melihat kecamatan.
              </li>
              <li>
                Lokasi perangkat hanya dipakai untuk mencari dan tidak disimpan, kecuali kamu
                menyimpannya sebagai alamat.
              </li>
              <li>Kamu bisa menghapus akun dan datanya kapan saja di halaman Akun.</li>
            </ul>
            <label className='w-check'>
              <input
                type='checkbox'
                aria-label='Saya setuju data saya dipakai seperti di atas'
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>Saya setuju data saya dipakai seperti di atas.</span>
            </label>
          </section>
          <div className='w-actions'>
            <button className='w-btn block' type='submit' disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan dan lanjut'}
            </button>
          </div>
        </>
      )}

      {info && (
        <p className='w-alert ok' role='status'>
          {info}
        </p>
      )}
      {error && (
        <p className='w-alert' role='alert'>
          {error}
        </p>
      )}
      {devHint && step === 'code' && (
        <p className='w-muted' style={{ marginTop: 12 }}>
          Mode pengembangan: kode juga dicetak di log server (terminal tempat server berjalan).
        </p>
      )}
    </form>
  );
}
