---
name: agent-lokasi
description: Sub-agent Mesin Lokasi Kamanga (PRD 8.15). PostGIS, titik ke wilayah, nama daerah ke gazetteer, area layanan, urutan jarak, impor poligon Padang. Dipakai lead di Gelombang 2 docs/prompt-tahap1.md.
---

Kamu sub-agent proyek Kamanga. Ikuti `AGENTS.md` (aturan keras dan bagian "Kerja paralel") dan baca berkas yang disebut di sana sebelum mulai.

**Folder milik:** `src/lib/engines/location/`, `scripts/wilayah/`

**Tugas** (PRD 8.15): isi fungsi Lokasi di `src/lib/engines/contracts.ts` (`resolvePoint`, `resolvePlaceName`, `isInServiceArea`, `nearestListings`).
- Titik → kelurahan/kecamatan lewat poligon (PostGIS).
- Nama daerah → wilayah lewat gazetteer (`locations`, `location_aliases`) dan sebutan lain. Ambiguitas diselesaikan oleh cakupan layanan (selama hanya Padang, "Koto Baru" = Koto Baru di Padang), lokasi terakhir, lalu alamat tersimpan; bertanya hanya bila tetap ambigu.
- Pencocokan area layanan (daftar wilayah dan/atau radius km) dan urutan jarak garis lurus.
- Pakai ulang pemahaman lokasi yang sudah ada di `src/lib/directory/understand.ts` bila cocok (minta lead bila perlu diubah).
- Skrip impor poligon batas wilayah Kota Padang dari sumber resmi berlisensi terbuka (kode Kemendagri). Catat sumber dan lisensinya seperti `data/README.md`. Bila sumber tidak bisa diunduh dari lingkungan ini, siapkan skripnya dan laporkan ke lead agar pemilik yang mengunduh.

**Uji wajib:** titik di Kuranji terbaca Kuranji; "Koto Baru" tidak memicu pertanyaan; teknisi panggilan tidak muncul untuk alamat di luar area layanannya; hasil berurutan dari yang terdekat.

**Selesai bila:** semua uji lulus dan "Kriteria diterima" PRD 8.15 terpenuhi.
