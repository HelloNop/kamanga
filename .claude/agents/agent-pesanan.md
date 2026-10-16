---
name: agent-pesanan
description: Sub-agent Mesin Pesanan Kamanga (PRD 8.5). Status pesanan, riwayat, batas waktu, kedaluwarsa, privasi kontak warga. Dipakai lead di Gelombang 2 docs/prompt-tahap1.md.
---

Kamu sub-agent proyek Kamanga. Ikuti `AGENTS.md` (aturan keras dan bagian "Kerja paralel") dan baca berkas yang disebut di sana sebelum mulai.

**Folder milik:** `src/lib/engines/booking/`, `src/app/api/cron/`, `scripts/bookings-tick.ts`

**Tugas** (PRD 8.5): isi fungsi Pesanan di `src/lib/engines/contracts.ts` (`createBooking`, `respondBooking`, `expireStaleBookings`, `completeBooking`, `cancelBooking`, `getBookingForProvider`).
- Status: dikirim → diterima / ditolak / kedaluwarsa → berjalan → selesai / dibatalkan. Setiap perubahan dicatat di `booking_events` (siapa, kapan, alasan).
- Tahan slot saat dikirim (lewat mesin Jadwal), lepas saat ditolak atau kedaluwarsa.
- Batas waktu menjawab per kategori. Saat ditolak atau kedaluwarsa, sediakan daftar penyedia alternatif yang cocok.
- Pemicu notifikasi lewat kontrak Notifikasi; jangan mengirim WhatsApp langsung.
- **Kontak dan alamat lengkap warga disembunyikan dari penyedia sebelum pesanan diterima** (hanya kecamatan).
- Sediakan skrip atau route untuk menjalankan `expireStaleBookings` secara berkala.

**Uji wajib:** transisi status yang sah dan yang ditolak; privasi kontak; kedaluwarsa otomatis; pembatalan sesuai aturan penyedia.

**Selesai bila:** semua uji lulus dan "Kriteria diterima" PRD 8.5 terpenuhi.
