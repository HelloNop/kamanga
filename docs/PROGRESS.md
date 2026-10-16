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

Status: **selesai** (15 Okt 2026). Empat sub-agent paralel, lalu digabung dan diuji lead di browser.

- **Warga** (agent-ui-warga): beranda "Kamanga hari ko?" dari tabel `doors`, halaman pintu (`/pintu/[slug]`) untuk keempat pintu, "Pakai lokasi saya" / ketik daerah, hasil dari `findProviders` urut terdekat, halaman pesan (`/pesan/[slug]`) dengan ringkasan aturan yang wajib disetujui, masuk OTP WA (`/masuk`) + nama panggilan + persetujuan privasi, status dan riwayat pesanan, ulasan, akun (alamat tersimpan, hapus akun), profil listing diperkaya. Uji `check:warga`.
- **Mitra** (agent-ui-mitra): `/mitra` ramah ponsel + PWA, beranda, pesanan, halaman token tanpa login, jadwal (unit, jam buka, pengecualian, kalender, blokir dua ketukan), usaha, tanya jawab, ulasan, statistik; `ScheduleEditor`/`QaEditor` dipakai juga di panel admin; portal vendor tidak bisa lagi memalsukan jenis/status/verifikasi. Uji `check:mitra`.
- **Admin** (agent-ui-admin): menu Pintu, Pesanan (antrean "teruskan ke penyedia" untuk mode cadangan, pesanan macet, catatan admin), Pengaturan, isian pintu/jadwal/batas waktu di kategori, jenis/titik publik/radius di listing, pertanyaan warga belum terjawab, uji pencarian mode Pintu dengan rincian skor. Uji `check:admin`.
- **Chat** (agent-chat): niat terstruktur di `chat_sessions.state`, diteruskan ke `findProviders`; kartu dengan slot; satu pertanyaan dengan tombol; lokasi perangkat tidak disimpan; jawaban tentang penyedia hanya dari datanya; di luar layanan lewat template. `eval:chat` 61/64 (95%), 86% tanpa AI. Mode `CHAT_MODE` "AI dulu" dihapus (PRD 8.2: template → kode → AI).
- Lead: sebutan lain kategori (padel, pijat, cukur, ...), label pelonggaran ramah warga, perbaikan pindah halaman setelah masuk OTP dan setelah keluar/hapus akun, tautan portal vendor ke `/mitra/usaha`, cache disk Turbopack dimatikan (disk penuh).
- **Uji di browser (360 px) oleh lead, berhasil:** beranda → Ka main → padel besok malam dekat Lubeg, 4 orang → slot → aturan → masuk OTP → kirim (#DYKHLG, menunggu 30 menit) → tautan token penyedia (kontak tertutup) → Terima (kontak terbuka, tombol kabari pemesan) → Selesai → ulasan "Puas, 5 bintang" → hapus akun (pesanan dan ulasan tetap, anonim; kontak dan nomor di log WA dihapus). Chat dengan kalimat PRD menampilkan kartu padel dan jam kosong. 24 halaman panel admin dan mitra dimuat 200 dengan akun uji sementara; pembagian peran benar.
- Semua uji lulus: typecheck, lint (0 galat), 17 script `check:*`, `eval:chat` 95%.

Temuan untuk Gelombang 4:
- Pilihan di halaman pesan (sewa raket, lama) hilang setelah masuk OTP, padahal teksnya berjanji tersimpan.
- Penyedia bisa menandai selesai sebelum jadwal dimulai.
- Header chat menampilkan "Daftar" (mitra), seharusnya "Masuk" untuk warga.
- Teks berganti di beranda tampak pucat; periksa kontras.
- Mode cadangan: pemberitahuan ke warga (ditolak, kedaluwarsa, jawaban pertanyaan) belum punya antrean tim di admin.
- Alur klaim usaha belum ada; notifikasi PWA belum ada.

## Gelombang 4 — Uji menyeluruh

Status: **selesai** (15 Okt 2026). agent-penguji menulis `tests/e2e.check.ts`, `tests/tampilan.check.ts`, dan `docs/laporan-uji.md`; lead memperbaiki temuannya (tabel "Status perbaikan" di laporan uji).

- Temuan kritis K1 (pengambilalihan akun warga lewat daftar email dengan nomor orang lain) diperbaiki di `src/lib/auth.ts` + `isCitizen()`; uji `check:auth`.
- S1–S4, R1–R5 diperbaiki; R6 bukan masalah; R11 diperbaiki sesudah tahap 1; R7–R10 terbuka (lihat di bawah).
- Hasil akhir: typecheck lulus; lint 0 galat; 20 script `check:*` lulus, termasuk `check:e2e` 18/18 (empat alur warga sampai ulasan, anti-bentrok bersamaan, privasi, keamanan, hapus akun) dan `check:tampilan` 0 temuan; `eval:chat` 95%.

## Laporan untuk pemilik

### Yang sudah jalan (coba di browser: `bun run dev`, buka http://localhost:3000)
1. **Beranda** "Kamanga hari ko?" dengan pintu dari database (`/`).
2. **Pintu Ka main / Ka rawat diri / Ka uda anta / Ka servis**: pilih jenis → tanggal/jam/jumlah → "Pakai lokasi saya" atau ketik daerah (mis. "Lubeg", "Koto Baru") → daftar penyedia terdekat dengan slot kosong, harga, verifikasi, ulasan.
3. **Pesan**: pilih slot → setujui aturan penting → masuk dengan nomor WA (kode OTP muncul di log server saat pengembangan) → pesanan terkirim → `/pesanan/<id>` menampilkan status.
4. **Penyedia**: admin membuka `/dashboard/bookings` → "Teruskan ke penyedia (WA)" membuka WhatsApp berisi pesan pesanan bertautan Terima/Tolak → penyedia menekan Terima (tanpa login) → kontak warga baru terbuka → Selesai → warga memberi ulasan.
5. **Dashboard mitra** `/mitra` (daftar di `/auth/sign-up`, lalu jadikan pemilik listing dummy lewat admin atau SQL): pesanan, jadwal, blokir slot dua ketukan, tanya jawab, ulasan, statistik.
6. **Dashboard admin** `/dashboard` (akun dari `ADMIN_EMAIL`): Pintu, Kategori & aturan, Pesanan (+ antrean pesan WA mode cadangan), Pengaturan, Uji pencarian dengan rincian skor.
7. **Chat** `/chat`: "Ado lapangan padel kosong nanti malam dakek Lubeg? Barampek kami." → kartu padel dengan jam kosong.

### Yang belum
- WhatsApp Business API resmi belum aktif (mode cadangan: tim meneruskan pesan dari nomor resmi lewat dashboard admin). Perlu: verifikasi Meta, isi 4 env `WA_*`, daftarkan 13 template di `src/lib/engines/notify/templates.ts`.
- Penjadwal berkala untuk `bun run bookings:tick` / `POST /api/cron/bookings` (isi `CRON_SECRET`). Tanpa itu kedaluwarsa tetap terjadi saat pesanan dibaca, tetapi pengingat dan selesai otomatis tidak jalan.
- Notifikasi PWA, poligon wilayah di luar Padang, `search.ts` lama masih earthdistance.

### Keputusan yang diambil lead (alasan di `docs/rencana-tahap1.md` bagian 2)
- Slot ditahan = pesanan berstatus "dikirim"; anti-bentrok dijamin constraint database.
- Mode cadangan WA: pesan ke penyedia dan ke warga dikirim TIM dari nomor resmi (bukan warga/penyedia sendiri) agar nomor warga tidak bocor dan token tidak terlihat warga.
- Token penyedia diturunkan dari kode pesanan + rahasia server (hanya hash yang disimpan).
- Hanya penyedia "kontak dicek" ke atas yang bisa dipesan; area layanan bawaan penyedia panggilan = kecamatannya + 5 km.
- Ulasan: puas/kurang puas wajib, bintang opsional (PRD §18 no. 3 masih terbuka).
- Hapus akun membatalkan pesanan aktif tanpa memandang batas pembatalan (UU PDP didahulukan).
- Chat selalu template → kode → AI; mode "AI dulu" dihapus.
- Cache disk Turbopack di mode dev dimatikan (disk laptop penuh).

### Langkah berikutnya yang disarankan
1. Bebaskan ruang disk (tersisa sekitar 3 GB).
2. Wawancara lapangan + isi data penyedia nyata (target PRD §14: 20 lapangan, 15 perawatan diri, 5 travel, 15 servis).
3. Ajukan verifikasi WhatsApp Business API dan template Meta; tambah batas OTP per IP sebelum API aktif.
4. Pasang penjadwal `bookings:tick` di VPS (cron tiap 1–5 menit).
5. Uji tampilan manual di ponsel sungguhan.

## Sesudah tahap 1 (15 Okt 2026)

- Batas OTP per IP, wajib header Origin, hitungan batas dikunci (temuan R11; migrasi `0013_otp_ip_hash.sql`).
- Alur klaim usaha: mitra mengklaim listing yang diinput tim (`/mitra/klaim`), verifikasi kode lewat WA usaha, antrean klaim di `/dashboard/review`. Uji `check:klaim`.
- Semua uji lulus setelah digabung: 21 script `check:*` termasuk `check:e2e` 18/18.

## Beranda chat-first (16 Okt 2026)

- Beranda `/` kini adalah chat (desain `/chat`), PRD 8.1 diperbarui. `/chat` dan `/chat?q=...` dialihkan ke `/` dan `/?q=...`; `paths.chat()` ikut menunjuk ke beranda.
- Slider pintu di atas kolom ketik (`src/features/chat/components/door-slider.tsx`): data dari tabel `doors`, geser otomatis 4 detik, kembali ke kartu pertama di ujung, berhenti saat disentuh, jalan lagi 6 detik setelah digeser, tombol jeda/putar, diam bila "kurangi gerak". Judul "Kamanga hari ko?" berganti mengikuti pintu aktif terdepan.
- "Coba tanya" menggantikan tombol pintu di chat; kartu intip dan lencana cakupan wilayah dibuang. Header menautkan Akun bila warga sudah masuk.
- Beranda lama (grid pintu marawa) dan komponen `RotatingText` dihapus. Prototipe di `docs/design/beranda-chat.html` (server statis: konfigurasi `prototipe` di `.claude/launch.json`).
- Uji: semua `check:*` lulus termasuk `check:e2e` 18/18 (bagian 17 kini memeriksa pengalihan `/chat`), `eval:chat` 95%; dicek di browser 360 px dan desktop.

## Asumsi yang diambil lead

- Lihat `docs/rencana-tahap1.md` bagian 2 (17 keputusan desain).

## Masalah terbuka

- R7: hasil kosong tanpa alasan dan tanpa pelonggaran saat wilayah jemput travel tidak mencakup titik warga (`providers.ts` belum menawarkan pelonggaran area layanan).
- R8: kontak warga tetap terbuka lewat tautan token tanpa batas waktu setelah diterima (perlu keputusan: tutup N hari setelah selesai?).
- R9: 3 kasus `eval:chat` meleset (salah ketik nama tempat, "cuci karpet").

- Poligon dan titik tengah baru ada untuk Kota Padang; lokasi lain belum.
- Template Meta (13) perlu didaftarkan pemilik sebelum API WA diaktifkan; daftar lengkap di laporan agent-wa (diringkas di `src/lib/engines/notify/templates.ts`).
- Batas permintaan OTP per IP belum ada (perlu sebelum API WA aktif, karena OTP berbayar).
- Balasan penyedia atas pertanyaan warga lewat WA baru dicatat; alur menyimpannya ke `listing_qa` menyusul (tahap 1 lewat dashboard mitra).
- `search.ts` lama masih memakai earthdistance; usulan pindah ke PostGIS.
- Formulir listing di panel belum menampilkan isian jenis, titik publik, dan radius (agent-ui-admin, Gelombang 3).
