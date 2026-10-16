// Alamat halaman bersama. Modul murni (tanpa database) agar aman diimpor komponen klien.
/** Alamat halaman yang ditautkan dari pesan WA dan antarhalaman. Dipakai mesin, chat, dan UI agar sama.
 *  Jangan menaruh koordinat perangkat atau data pribadi di query URL (tercatat di log server). */
export const paths = {
  /** Halaman pesanan untuk warga (cek kepemilikan di halaman). */
  citizenBooking: (id: number) => `/pesanan/${id}`,
  /** Riwayat pesanan warga. */
  citizenBookings: () => '/pesanan',
  /** Halaman Terima/Tolak untuk penyedia lewat token dari pesan WA, tanpa login. */
  providerBookingToken: (token: string) => `/mitra/pesanan/t/${token}`,
  /** Halaman pesanan di dashboard mitra (penyedia berakun). */
  providerBooking: (id: number) => `/mitra/pesanan/${id}`,
  /** Daftar pertanyaan warga yang menunggu dijawab penyedia. */
  providerQuestions: () => '/mitra/tanya-jawab',
  /** Halaman pintu, mis. /pintu/ka-main. */
  door: (slug: string) => `/pintu/${slug}`,
  /** Mulai memesan satu penyedia: ringkasan aturan → masuk OTP bila perlu → kirim. */
  bookingStart: (
    listingSlug: string,
    q?: { unitId?: number; startsAt?: Date; endsAt?: Date; seats?: number }
  ) => {
    const p = new URLSearchParams();
    if (q?.unitId) p.set('unit', String(q.unitId));
    if (q?.startsAt) p.set('mulai', q.startsAt.toISOString());
    if (q?.endsAt) p.set('selesai', q.endsAt.toISOString());
    if (q?.seats) p.set('kursi', String(q.seats));
    const qs = p.toString();
    return `/pesan/${listingSlug}${qs ? `?${qs}` : ''}`;
  },
  /** Masuk warga dengan nomor WA + OTP. */
  citizenSignIn: (next?: string) => `/masuk${next ? `?next=${encodeURIComponent(next)}` : ''}`,
  /** Profil publik listing. */
  listing: (slug: string) => `/listing/${slug}`,
  /** Chat bebas di beranda, opsional dengan pesan pertama. */
  chat: (q?: string) => `/${q ? `?q=${encodeURIComponent(q)}` : ''}`
};
