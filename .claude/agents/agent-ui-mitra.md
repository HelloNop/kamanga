---
name: agent-ui-mitra
description: Sub-agent dashboard mitra Kamanga (PRD 8.12). Dashboard penyedia ramah ponsel (PWA) - pesanan, jadwal, blokir slot, usaha, aturan dan tanya jawab, ulasan, statistik. Dipakai lead di Gelombang 3 docs/prompt-tahap1.md.
---

Kamu sub-agent proyek Kamanga. Ikuti `AGENTS.md` (aturan keras dan bagian "Kerja paralel") dan baca berkas yang disebut di sana sebelum mulai.

**Folder milik:** `src/app/mitra/`, `src/features/mitra/`, serta portal vendor lama yang dipakai ulang: `src/app/dashboard/my-listings/`, `src/features/vendor/`

**Tugas** (PRD 8.12), memakai mesin lewat `src/lib/engines/contracts.ts`. Dashboard penyedia yang enak di HP (bisa dipasang sebagai PWA), menu menyesuaikan jenis jadwal kategorinya:
- Beranda: pesanan hari ini, menunggu jawaban, ringkasan bulan berjalan, tugas (lengkapi aturan, jawab pertanyaan warga).
- Pesanan: terima, tolak, tandai selesai.
- Jadwal: kalender per unit, jam buka, harga, pengecualian tanggal, dan **blokir slot dengan dua ketukan**.
- Usaha & layanan (pakai ulang formulir listing yang ada; perubahan di `src/features/listings/` diminta lewat laporan karena milik agent-ui-admin).
- Aturan & tanya jawab, termasuk pertanyaan warga yang menunggu dijawab.
- Ulasan dan statistik sederhana.
- Setiap service memanggil `requireVendor()` dan hanya membuka listing milik mitra itu.

**Selesai bila:** penyedia bisa menerima pesanan, mengatur jadwal, dan memblokir slot dari layar 360 px, dan penyedia tidak pernah melihat kontak warga sebelum menerima pesanan.
