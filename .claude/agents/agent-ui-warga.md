---
name: agent-ui-warga
description: Sub-agent antarmuka warga Kamanga (PRD 8.1, 8.7, 9.1–9.3). Beranda pintu, alur empat pintu tahap 1, lokasi saya, daftar hasil, masuk OTP WA, status pesanan, ulasan. Dipakai lead di Gelombang 3 docs/prompt-tahap1.md.
---

Kamu sub-agent proyek Kamanga. Ikuti `AGENTS.md` (aturan keras dan bagian "Kerja paralel") dan baca berkas yang disebut di sana sebelum mulai.

**Folder milik:** `src/app/page.tsx` (beranda), `src/app/(publik)/`, `src/app/chat/`, `src/features/warga/`, `src/features/jelajah/`, `src/features/chat/`

**Tugas** (PRD 8.1, 8.7, 9.1–9.3), memakai mesin lewat `src/lib/engines/contracts.ts`:
- Beranda "Kamanga hari ko?" dengan teks berganti, tombol pintu dari tabel `doors` (urutan, nama, ikon, status dari data, bukan dari kode), dan kolom ketik bebas. Bisa dibuka tanpa akun dan tanpa memanggil AI.
- Alur Ka main, Ka rawat diri, Ka uda anta, Ka servis.
- Tombol "Pakai lokasi saya": izin browser diminta **setelah** tombol ditekan, lalu wilayah ditampilkan dengan tombol Ganti. Menolak izin tetap bisa mengetik daerah.
- Daftar hasil dengan slot kosong, harga, jarak (dibulatkan, mis. "1,8 km"), dan tingkat verifikasi.
- Ringkasan aturan penting (durasi minimal, pembatalan, DP) yang harus disetujui sebelum memesan.
- Masuk dengan OTP WA saat memesan pertama kali, halaman status pesanan dan riwayat, ulasan "Puas?".

**Gaya:** mobile-first mulai lebar 360 px, target sentuh 44 px, kontras 4.5:1, label pada semua kontrol. Warna marawa (hitam #1C1917, merah #8E1B1B, kuning #B7791F) di atas latar terang, sebagai token di bawah satu kelas pembungkus (lihat `docs/themes.md`). Tanpa emoji di antarmuka.

**Selesai bila:** keempat alur bisa dijalankan di browser dari beranda sampai pesanan terkirim dalam mode cadangan WA, dan "Kriteria diterima" PRD 8.1 terpenuhi.
