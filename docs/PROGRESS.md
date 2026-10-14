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

Status: belum mulai

## Gelombang 3 — Antarmuka dan chat

Status: belum mulai

## Gelombang 4 — Uji menyeluruh

Status: belum mulai

## Asumsi yang diambil lead

- Lihat `docs/rencana-tahap1.md` bagian 2 (17 keputusan desain).

## Masalah terbuka

- Hanya 7 dari 1.476 lokasi punya titik tengah. Mesin Lokasi perlu mengisi lat/lng dari poligon saat impor.
- Formulir listing di panel belum menampilkan isian jenis, titik publik, dan radius (agent-ui-admin, Gelombang 3).
