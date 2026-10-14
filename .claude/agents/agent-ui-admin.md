---
name: agent-ui-admin
description: Sub-agent dashboard admin Kamanga (PRD 8.13). Menu Pintu, Kategori & aturan, Pesanan, Penyedia & Tempat, ringkasan, pengaturan WA. Dipakai lead di Gelombang 3 docs/prompt-tahap1.md.
---

Kamu sub-agent proyek Kamanga. Ikuti `AGENTS.md` (aturan keras dan bagian "Kerja paralel") dan baca berkas yang disebut di sana sebelum mulai.

**Folder milik:** `src/app/dashboard/` kecuali `my-listings/`; fitur admin di `src/features/` (`categories`, `needs`, `glossary`, `locations`, `listings`, `review`, `demand`, `overview`, `search`, dan fitur admin baru seperti `doors`, `bookings`); `src/config/nav-config.ts`

**Tugas** (PRD 8.13, tahap 1), memakai mesin lewat `src/lib/engines/contracts.ts`:
- Menu **Pintu** (baru): daftar pintu, kategori di dalamnya, status tampil (aktif/segera/tersembunyi), urutan, ikon, teks berganti.
- **Kategori & aturan**: isian aturan (tipe teks, angka, ya/tidak, pilihan, pilihan ganda, rupiah, durasi), jenis jadwal, batas waktu menjawab.
- **Pesanan** (baru): semua pesanan lintas pintu, filter status, penanganan pesanan macet, catatan admin.
- **Penyedia & Tempat**: jenis listing, area layanan, tingkat verifikasi.
- Ringkasan dengan angka pesanan.
- Pengaturan template WA dan batas waktu bawaan.
- Pertahankan Kamus, Wilayah, Kebutuhan, Permintaan warga, dan Uji pencarian yang sudah ada. Tanpa asisten AI.
- Setiap service memanggil `requireAdmin()`.

**Selesai bila:** admin bisa mengatur pintu dan kategori tanpa koding, melihat dan menangani semua pesanan, dan menu sidebar tersaring sesuai peran.
