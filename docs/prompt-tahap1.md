# Prompt sesi panjang: membangun Kamanga tahap 1

> Cara pakai: buka Claude Code di folder proyek `~/Code/projek/kamanga`, lalu kirim pesan pertama:
> **"Baca docs/prompt-tahap1.md dan jalankan sebagai lead, lanjutkan dari gelombang yang belum selesai."**
> Atau tempel seluruh isi di bawah garis.

---

Kamu adalah **agent utama (lead)** untuk proyek Kamanga di folder ini. Sesi ini panjang dan kamu bekerja bersama beberapa **sub-agent** yang berjalan paralel. Tugasmu: merencanakan, membagi pekerjaan, menjaga agar sub-agent tidak saling bertabrakan, menggabungkan hasilnya, menguji, dan melapor.

Pemilik proyek masih belajar. Setiap akhir gelombang, jelaskan apa yang sudah dibuat dengan **Bahasa Indonesia yang sederhana**, tanpa jargon yang tidak dijelaskan.

## Sumber kebenaran

- **`KAMANGA_PRD.md` adalah acuan utama.** Bila ada yang bertentangan dengan dokumen lain atau dengan kode yang sudah ada, ikuti `KAMANGA_PRD.md`.
- **`AGENTS.md`** berisi aturan keras, peta istilah PRD → kode, perintah, dan pola kode. Berlaku untuk lead dan semua sub-agent.
- Repo ini Kamanga v2 (ada riwayat git), sudah dibersihkan dari sisa template starter. Kodenya sudah punya: Next.js, Drizzle, Better Auth (peran admin dan vendor), skema listing/kategori/kebutuhan/lokasi/kamus, panel admin, portal vendor, antrean review, pencarian dan ranking (`src/lib/directory`), router chat template → kode → AI (`src/lib/kamanga-ai`), set uji `eval:chat`, log permintaan, foto R2. Gambaran lengkapnya ada di `docs/arsip/KAMANGA_PRD-v2.md` bagian 8. **Pakai ulang yang ada, ubah sesuai PRD, jangan tulis ulang dari nol tanpa alasan.**

## Ruang lingkup sesi ini

**Dikerjakan: tahap 1 menurut PRD (bagian 7, 8, 9, 10, 14).**
- Pintu tahap 1: Ka main, Ka rawat diri, Ka uda anta, Ka servis (tanpa diagnosis), plus data Tempat (informasi saja).
- Mesin: Fondasi (dirapikan), **Jadwal**, **Pesanan**, **Lokasi** (PostGIS), **Notifikasi WA** (dengan cadangan), **Mitra** (dashboard penyedia).
- Beranda baru "Kamanga hari ko?", alur warga keempat pintu, akun warga lewat OTP WA, dashboard mitra, perubahan dashboard admin, chat bebas yang diteruskan ke mesin.

**Tidak dikerjakan** (jangan dibangun, cukup jangan menghalangi di masa depan):
pembayaran, saldo, tagihan, langganan; Panduan (pohon diagnosis, kartu); Estimasi; Rekomendasi; Ka manyewa, Ka jalan-jalan, Kabatanyo, Kabaralek, Ka balanjo, Ka baubek; pintu freelancer; **asisten AI untuk admin** (dibahas terpisah); chatbot di nomor penyedia; aplikasi native.

## Aturan keras

Lihat bagian **Aturan keras** dan **Kerja paralel** di `AGENTS.md`. Ringkasnya: hanya database `kamanga_v2`; tanpa rahasia di kode; WhatsApp lewat satu adapter dengan mode cadangan sebagai bawaan; AI tidak mengarang; kontak warga baru terbuka setelah pesanan diterima; file bersama hanya diubah lead; tanpa layanan berbayar baru; jangan menghapus di luar rencana.

## Cara kerja

- Catat rencana dan kemajuan di **`docs/PROGRESS.md`**: setiap gelombang, apa yang selesai, hasil uji, masalah terbuka, dan asumsi yang diambil. Ini juga alat ingatanmu bila konteks percakapan menipis; baca ulang sebelum memulai gelombang baru.
- Sub-agent sudah didefinisikan di **`.claude/agents/`** (brief, folder milik, uji wajib). Jalankan dengan Agent tool, `subagent_type` = nama sub-agent, **paralel** untuk pekerjaan dalam satu gelombang. Di pesan tugasnya tambahkan konteks yang tidak ada di brief (keputusan dari `docs/rencana-tahap1.md`, hasil gelombang sebelumnya), karena sub-agent tidak melihat percakapan ini.
- Setiap sub-agent mengakhiri pekerjaannya dengan **laporan singkat** (format di `AGENTS.md`).
- Setelah setiap gelombang: lead menggabungkan, menjalankan `typecheck`, `lint`, dan semua uji, memperbaiki yang rusak, lalu **commit** dengan pesan yang jelas dalam Bahasa Indonesia.
- **Berhenti dan tanya pemilik** hanya di titik bertanda 🛑. Selain itu, ambil keputusan paling masuk akal, catat asumsinya di `docs/PROGRESS.md`, dan lanjutkan.

| Sub-agent | Gelombang | Folder milik |
|---|---|---|
| `agent-jadwal` | 2 | `src/lib/engines/schedule/` |
| `agent-pesanan` | 2 | `src/lib/engines/booking/`, `src/app/api/cron/`, `scripts/bookings-tick.ts` |
| `agent-lokasi` | 2 | `src/lib/engines/location/`, `scripts/wilayah/`, `data/wilayah/` |
| `agent-wa` | 2 | `src/lib/engines/notify/`, `src/app/api/wa/` |
| `agent-ui-warga` | 3 | `src/app/page.tsx`, `src/app/(publik)/`, `src/features/{warga,jelajah}/` |
| `agent-ui-mitra` | 3 | `src/app/mitra/`, `src/features/mitra/`, `src/app/dashboard/my-listings/`, `src/features/vendor/` |
| `agent-ui-admin` | 3 | `src/app/dashboard/` (kecuali `my-listings/`), fitur admin di `src/features/`, `src/config/nav-config.ts` |
| `agent-chat` | 3 | `src/lib/kamanga-ai/`, `src/app/api/chat/`, `src/app/chat/`, `src/features/chat/` |
| `agent-penguji` | 4 | `tests/`, `docs/laporan-uji.md` |

Folder yang tidak tercantum (termasuk `src/app/auth/`, `src/lib/auth.ts`, `src/db/`) milik lead. Bila `docs/rencana-tahap1.md` memutuskan pembagian lain, perbarui tabel ini dan berkas di `.claude/agents/`.

---

## Gelombang 0 — Persiapan (lead saja, berurutan)

Langkah 1, 2, dan 5 sudah dikerjakan pada 14 Oktober 2026:
1. ~~`git init`~~: repo sudah punya riwayat git.
2. ~~Rapikan dokumen~~: PRD baru menjadi `KAMANGA_PRD.md`; PRD v2 lama dan PDF konsep dipindah ke `docs/arsip/`; `AGENTS.md`, `README.md`, `docs/` diperbarui; brief sub-agent menjadi `.claude/agents/`.
5. ~~Bersihkan sisa template starter~~: mesin ganti-tema, 16 font tak terpakai, infobar, filter tabel lanjutan, field formulir demo, konfigurasi npm/pnpm/clerk/sentry, dokumen tema template.

Sisa langkah:

3. Database: `kamanga_v2` sudah ada (10 migrasi, data acuan, 132 listing dummy). Aktifkan ekstensi **PostGIS** dan `btree_gist` lewat migrasi baru (pola `0000_ekstensi.sql`; `vector`, `pg_trgm`, `unaccent` sudah aktif, `cube` + `earthdistance` dipakai sementara untuk jarak dan nanti digantikan PostGIS). 🛑 Bila `select * from pg_available_extensions where name = 'postgis'` kosong, berhenti dan minta pemilik menjalankan `brew install postgis`.
4. `bun install`, jalankan migrasi dan seed acuan, pastikan aplikasi bisa jalan (`bun run dev`) dan `typecheck` lulus.
6. Baca kode yang ada (skema, `src/lib/directory`, `src/lib/kamanga-ai`, `src/app`) dan tulis **`docs/rencana-tahap1.md`**: peta perubahan dari kode sekarang ke PRD, tabel/kolom baru, folder baru, dan pembagian kerja sub-agent (sesuaikan tabel di atas bila perlu).
7. Buat `docs/PROGRESS.md`, lalu commit.

## Gelombang 1 — Fondasi data dan kontrak (lead saja)

Ini harus selesai sebelum sub-agent mulai, karena semua bergantung padanya.

1. **Skema dan migrasi** sesuai PRD bagian 10 dan 8.15, minimal:
   - `doors` (pintu): slug, nama, ikon, keterangan, urutan, status tampil (`active` | `soon` | `hidden`), jenis (`single` | `plan` | `guide`).
   - Tambahan di `categories`: pintu utama, skema isian aturan (pakai `attribute_schema` yang ada, tambah tipe rupiah dan durasi), jenis jadwal (`slot` | `seat` | `date_stock` | `survey` | `none`), batas waktu menjawab (menit).
   - Tambahan di `listings`: jenis (`provider` | `place`), titik PostGIS (`geography(Point)`), titik publik atau privat, area layanan (daftar wilayah dan/atau radius km).
   - Poligon batas wilayah di tabel `locations` (`geography(MultiPolygon)`) dan kode resmi wilayah.
   - `listing_qa` (tanya jawab per penyedia, termasuk asal: penyedia atau dari pertanyaan warga).
   - `units`, `schedule_rules`, `schedule_exceptions`, `slot_blocks`.
   - `bookings` + `booking_events` (riwayat status), dengan **constraint anti-tumpang-tindih** per unit (exclusion constraint + `btree_gist`) untuk pesanan aktif dan tahanan sementara.
   - `reviews`, `saved_addresses`, `wa_messages`, data warga (nomor WA terverifikasi; peran baru `citizen` di Better Auth bila perlu).
2. **Seed acuan** (`src/db/data/`, `bun run db:seed-reference`): pintu tahap 1 dan tahap berikut (status `soon`/`hidden`), kategori tahap 1 beserta pintu utamanya, jenis jadwal, dan isian aturan contoh (padel, barbershop, travel, servis AC sesuai Lampiran B PRD), serta sebutan lain ("sewa lapangan" → Ka main).
3. **Kontrak** di `src/lib/engines/contracts.ts`: tipe dan tanda tangan fungsi yang akan diisi sub-agent, minimal:
   - Jadwal: `getAvailability(unitIds, range)`, `holdSlot(...)`, `releaseHold(...)`, `blockSlot(...)`.
   - Pesanan: `createBooking(...)`, `respondBooking(id, accept|reject, actor)`, `expireStaleBookings(now)`, `completeBooking(...)`, `cancelBooking(...)`, `getBookingForProvider(...)` (menyembunyikan kontak sebelum diterima).
   - Lokasi: `resolvePoint(lat,lng)` → wilayah, `resolvePlaceName(text, context)`, `isInServiceArea(listing, point)`, `nearestListings(...)`.
   - Notifikasi: `sendWa(template, to, params)` dengan dua implementasi (cadangan dan API resmi).
4. **Data contoh** untuk pengembangan: perluas listing dummy yang ada (`src/db/make-dummy.ts` → `data/dummy-listings.csv`, `bun run db:seed-dummy` / `db:clear-dummy`) menjadi sekitar 10 penyedia per pintu tahap 1 di Padang, lengkap dengan unit, jadwal, dan isian aturan. Tetap memakai kategori acuan, slug `dummy-`, nama `[DUMMY]`.
5. `typecheck` lulus, commit.

## Gelombang 2 — Mesin (4 sub-agent paralel)

Jalankan bersamaan: **agent-jadwal**, **agent-pesanan**, **agent-lokasi**, **agent-wa**. Setelah semua melapor: gabungkan, daftarkan uji baru sebagai script `check:*`, jalankan semua uji, perbaiki, commit.

## Gelombang 3 — Antarmuka dan chat (4 sub-agent paralel)

Jalankan bersamaan: **agent-ui-warga**, **agent-ui-mitra**, **agent-ui-admin**, **agent-chat**. Mereka memakai mesin dari gelombang 2 lewat `contracts.ts`. Setelah semua melapor: gabungkan, uji, perbaiki, commit.

## Gelombang 4 — Uji menyeluruh (agent-penguji + lead)

1. Jalankan **agent-penguji**.
2. Lead memperbaiki temuan (atau mengirim kembali ke sub-agent pemilik foldernya), lalu menjalankan ulang sampai bersih.
3. Commit akhir dan tulis **laporan untuk pemilik** di `docs/PROGRESS.md` dan di chat:
   - apa yang sudah jalan (dengan cara mencobanya di browser),
   - apa yang belum,
   - keputusan yang diambil sendiri beserta alasannya,
   - langkah berikutnya yang disarankan.

---

## Titik henti 🛑 (tanya pemilik)

- PostGIS belum terpasang atau database tidak bisa dibuat.
- Data poligon wilayah tidak bisa diunduh.
- Ada keputusan produk yang tidak dijawab PRD dan akan sulit diubah nanti.
- Sebelum menghapus apa pun di luar rencana di atas.

Mulailah dari gelombang pertama yang belum selesai menurut `docs/PROGRESS.md` (bila belum ada: Gelombang 0 langkah 3). Sebelum mengubah kode, tulis rencana singkatmu di chat dalam Bahasa Indonesia sederhana, lalu langsung kerjakan tanpa menunggu persetujuan kecuali di titik 🛑.
