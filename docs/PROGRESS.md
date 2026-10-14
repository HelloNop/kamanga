# Kemajuan tahap 1

Catatan lead. Rencana kerja: `docs/prompt-tahap1.md`. Peta teknis dan keputusan desain: `docs/rencana-tahap1.md`.

## Gelombang 0 — Persiapan

Status: **selesai** (15 Okt 2026)

- PostGIS 3.6 dan `btree_gist` aktif lewat migrasi `0010_postgis.sql`.
- `bun install`, migrasi, `typecheck`, `lint` lulus (lint: 92 peringatan lama, 0 galat).
- Database `kamanga_v2`: 10 migrasi lama, 1.476 lokasi, 42 kategori, 132 listing dummy, 1 admin.
- `docs/rencana-tahap1.md` ditulis.

## Gelombang 1 — Fondasi data dan kontrak

Status: **selesai** (15 Okt 2026)

- Migrasi `0011_tahap1_fondasi.sql`: tabel `doors`, `units`, `schedule_rules`, `schedule_exceptions`, `slot_blocks`, `bookings`, `booking_contacts`, `booking_events`, `reviews`, `listing_qa`, `saved_addresses`, `wa_messages`, `wa_otps`, `app_settings`, `listing_daily_stats`; kolom baru di `categories`, `listings`, `locations`, `user`. Titik PostGIS sebagai kolom turunan dari lat/lng. Exclusion constraint `bookings_no_overlap` dan `slot_blocks_no_overlap` (sudah diuji manual: irisan ditolak, bersebelahan boleh, pesanan ditolak melepas slot).
- Login warga: plugin Better Auth `phone-number` (endpoint kirim-OTP bawaan dimatikan; verifikasi lewat `notify.verifyOtp`), peran `citizen`, `requireCitizen()`, `requireStaff()` untuk `/dashboard`.
- Tipe isian aturan `rupiah` dan `duration` (+ uji di `check:listings`).
- Data acuan: 10 pintu, 15 kategori baru, pintu dan jenis jadwal untuk kategori lama, isian aturan Lampiran B, 5 kebutuhan baru, 12 istilah kamus (termasuk "sewa lapangan" → Ka main).
- Kontrak `src/lib/engines/contracts.ts` + stub empat mesin; pembantu waktu WIB `src/lib/engines/time.ts`; pengaturan `src/lib/settings.ts`.
- Listing: kolom `kind`, `point_is_public`, `service_radius_km` di formulir (skema), repository, dan impor CSV.
- Dummy: 53 penyedia/tempat tahap 1 di kecamatan Padang (`dummy-padang-*`), 82 unit dan 699 aturan jam buka (termasuk lewat tengah malam, istirahat Jumat, rute travel). Data dummy lama tidak berubah.
- Uji: typecheck lulus; semua `check:*` lulus.

## Gelombang 2 — Mesin

Status: **selesai** (15 Okt 2026). Empat sub-agent paralel, lalu digabung lead.

- **Jadwal** (`src/lib/engines/schedule/`, agent-jadwal): slot kosong dari jam buka (beberapa interval sehari, lewat tengah malam, jeda, durasi minimal, harga jam ramai), pengecualian tanggal, blokir manual, kursi travel, `findConflicts`. Uji `check:schedule` (11 kelompok, termasuk dua permintaan bersamaan).
- **Pesanan** (`src/lib/engines/booking/`, `src/app/api/cron/bookings`, `scripts/bookings-tick.ts`, agent-pesanan + lead): semua transisi + riwayat, kontak warga terkunci sampai diterima, kedaluwarsa (tick, cron, malas saat dibaca), pengingat, selesai otomatis, ulasan, alternatif. Lead menambah `resendProviderNotice` dan template `booking_cancelled`. Uji `check:booking`.
- **Lokasi** (`src/lib/engines/location/`, `scripts/wilayah/`, `data/wilayah/`, agent-lokasi): poligon Kota Padang (11 kecamatan, 104 kelurahan, kode Kemendagri, sumber `cahyadsn/wilayah_boundaries` MIT), titik → wilayah, nama → wilayah ("Koto Baru" → Koto Baru Nan XX tanpa bertanya), area layanan, urutan jarak. Uji `check:location` (berjalan di koneksi baca-saja untuk membuktikan koordinat tidak disimpan).
- **Notifikasi WA** (`src/lib/engines/notify/`, `src/app/api/wa/`, agent-wa): satu adapter, mode cadangan `wa.me` tanpa env, API resmi bila 4 env diisi, 13 template, OTP ber-hash (HMAC) dengan batas percobaan/permintaan, webhook bertanda tangan. Uji `check:notify`.
- **Pencarian penyedia** (`src/lib/directory/providers.ts`, lead): `findProviders` untuk pintu dan chat (syarat wajib, slot kosong, jarak/area layanan, rute travel, "belum pasti", pelonggaran ditawarkan). Uji `check:providers`.
- Semua uji lulus: typecheck, 14 script `check:*`. Lint 0 galat.
- `check:search` disesuaikan: Lubuk Begalung kini punya titik sendiri (bukan titik kota).

Keputusan lead di gelombang ini:
- Mode cadangan: pesan ke penyedia diteruskan tim dari nomor resmi Kamanga, bukan warga (privasi nomor warga dan token). Lihat rencana keputusan 8.
- Token penyedia diturunkan dari kode pesanan + rahasia server (rencana keputusan 7).
- Pengecualian tanggal berlaku per "hari usaha": interval lewat tengah malam ikut tanggal mulainya.
- Area layanan bawaan penyedia panggilan tanpa data: kecamatannya + 5 km (PRD §18 no. 9 masih terbuka).

## Gelombang 3 — Antarmuka dan chat

Status: belum mulai

## Gelombang 4 — Uji menyeluruh

Status: belum mulai

## Asumsi yang diambil lead

- Lihat `docs/rencana-tahap1.md` bagian 2 (17 keputusan desain).

## Masalah terbuka

- Poligon dan titik tengah baru ada untuk Kota Padang; lokasi lain belum.
- Template Meta (13) perlu didaftarkan pemilik sebelum API WA diaktifkan; daftar lengkap di laporan agent-wa (diringkas di `src/lib/engines/notify/templates.ts`).
- Batas permintaan OTP per IP belum ada (perlu sebelum API WA aktif, karena OTP berbayar).
- Balasan penyedia atas pertanyaan warga lewat WA baru dicatat; alur menyimpannya ke `listing_qa` menyusul (tahap 1 lewat dashboard mitra).
- `search.ts` lama masih memakai earthdistance; usulan pindah ke PostGIS.
- Formulir listing di panel belum menampilkan isian jenis, titik publik, dan radius (agent-ui-admin, Gelombang 3).
