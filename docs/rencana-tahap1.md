# Rencana teknis tahap 1

Peta dari kode v2 sekarang ke `KAMANGA_PRD.md` (bagian 7–10, 14). Ditulis lead di Gelombang 0, diperbarui bila keputusan berubah. Kemajuan dicatat di `docs/PROGRESS.md`.

## 1. Yang sudah ada dan dipakai ulang

| Bagian | Isi sekarang | Nasib di tahap 1 |
|---|---|---|
| `src/db/schema.ts` | kategori, kelompok, kebutuhan, lokasi + sebutan lain, listing (+kategori, area, revisi, klaim), kamus, chat, log pencarian | Diperluas (bagian 3). Tidak ada tabel yang dihapus. |
| `src/lib/directory/` | pemahaman kata warga (`understand.ts`), pencarian + ranking tanpa AI | Tetap dipakai pencarian. Mesin Lokasi memakai ulang `resolveLocation`. Jarak masih `earthdistance` sampai Lokasi siap; perpindahan ke PostGIS dicatat sebagai pekerjaan lanjutan. |
| `src/lib/kamanga-ai/` | router template → kode → AI, gateway model, batas pemakaian, eval | Diubah agent-chat: keluarannya menjadi niat terstruktur yang diteruskan ke mesin. |
| Panel admin `src/app/dashboard/` | listing, antrean, kategori, kebutuhan, kamus, lokasi, permintaan, uji pencarian | Ditambah menu Pintu, Pesanan, Pengaturan (agent-ui-admin). |
| Portal vendor `my-listings` | daftar dan formulir listing milik vendor | Dipakai ulang untuk menu "Usaha & layanan" di dashboard mitra. |
| `/chat`, `/jelajah`, `/listing/[slug]` | chat warga, jelajah, profil listing | Beranda baru di `/`, alur pintu, status pesanan (agent-ui-warga). |
| Better Auth | peran `admin`, `vendor`, email + sandi | Ditambah peran `citizen` dan login nomor WA + OTP (plugin `phone-number`). |

## 2. Keputusan desain (lead)

1. **Waktu sebuah slot ditahan = baris pesanan berstatus `sent`.** Tidak ada tabel "tahanan" terpisah. `holdSlot()` di Mesin Jadwal memeriksa slot (jam buka, pengecualian, blokir, sisa kursi) dan **mengunci baris unit** (`select … for update`) di dalam transaksi pembuatan pesanan; baris pesanan lalu disisipkan di transaksi yang sama. Slot lepas otomatis ketika status berubah menjadi `rejected`/`expired`/`cancelled`. Karena itu `releaseHold` tidak diperlukan.
2. **Anti-bentrok dijamin database:** exclusion constraint `bookings_no_overlap` (`btree_gist`) pada `(unit_id, tstzrange(starts_at, ends_at))` untuk pesanan `exclusive` berstatus `sent`/`accepted`/`in_progress`. Blokir manual punya constraint serupa antar-blokir. Bentrok pesanan ↔ blokir dicegah karena `holdSlot` dan `blockSlot` sama-sama mengunci baris unit lebih dulu.
3. **Kursi travel** (`schedule_kind = seat`): pesanan `exclusive = false`, sisa kursi = kapasitas unit − jumlah kursi pesanan aktif di keberangkatan itu, dihitung di bawah kunci unit yang sama.
4. **Unit travel = satu rute** (`units.origin_location_id` → `destination_location_id`, kapasitas = kursi). Setiap baris `schedule_rules` = satu jam keberangkatan (`start_time`) dengan durasi perjalanan (`slot_minutes`). Wilayah jemput = `listing_areas`.
5. **Ka servis tanpa slot:** pesanan berupa permintaan (`starts_at`/`ends_at` kosong); masalah, tanggal, dan bagian hari ada di `bookings.details`.
6. **Kontak warga disimpan terpisah** di `booking_contacts` (nomor, nama, alamat, titik). Hanya `getBookingForProvider()` yang membacanya, dan hanya bila status `accepted`/`in_progress`/`completed`. Sebelumnya penyedia hanya melihat kecamatan (`bookings.district_id`).
7. **Penyedia tanpa akun tetap bisa menjawab:** setiap pesanan punya token acak; yang disimpan hanya hash-nya (`bookings.provider_token_hash`). Tautan `/mitra/pesanan/t/<token>` dikirim di pesan WA (mode cadangan maupun API) dan membuka halaman Terima/Tolak tanpa login.
8. **Mode cadangan WA:** `sendWa()` mengembalikan tautan `wa.me` berisi pesan terisi; UI menampilkannya sebagai tombol (mis. warga menekan "Kirim pesanan ke penyedia lewat WhatsApp"). Kode OTP dicetak ke log server saat `NODE_ENV !== 'production'`.
9. **OTP warga:** endpoint kirim-OTP bawaan plugin `phone-number` dimatikan (`disabledPaths`) karena menyimpan kode polos. Kode dibuat dan dikirim Mesin Notifikasi (`requestOtp`, hash di `wa_otps`), lalu klien memanggil `authClient.phoneNumber.verify()`; plugin memakai `verifyOTP` kustom yang memanggil `verifyOtp` milik Mesin Notifikasi, lalu membuat akun (peran `citizen`) dan sesi.
10. **Titik PostGIS sebagai kolom turunan:** `listings.point` dan `locations.center` adalah `geography(Point, 4326)` yang dihitung database dari `lat`/`lng` (generated column). Formulir, CSV, dan pencarian lama tetap menulis `lat`/`lng`; mesin Lokasi memakai `point`. Poligon wilayah di `locations.boundary` (`geography(MultiPolygon, 4326)`).
11. **Isian aturan:** tipe `rupiah` (bilangan bulat) dan `duration` (menit) ditambahkan ke `attribute_schema`. Kunci yang dipakai mesin: `min_duration`, `cancel_before` (menit), `dp_required` (ya/tidak). Aturan yang ditampilkan saat memesan disalin ke `bookings.rules_snapshot`, jadi pembatalan selalu memakai aturan yang disetujui warga.
12. **Ulasan:** `satisfied` (puas/kurang puas) wajib, `stars` (1–5) opsional, sampai PRD §18 no. 3 diputuskan.
13. **Pengaturan admin** (template WA, batas waktu menjawab bawaan) di tabel kunci-nilai `app_settings`. Batas chat dan rem biaya AI tetap di env untuk sekarang.
14. **Pesanan hanya untuk listing `kind = provider`, berstatus `published`, tingkat verifikasi minimal `contact_checked`** (PRD 8.14 [USULAN]), **berkategori dengan pintu berstatus `active`**, dan jenis jadwal `slot`, `seat`, atau `none` (`date_stock`/`survey` baru tahap 2). Kategori `none` memakai formulir permintaan.
15. **Pintu tambahan** (kategori tampil di pintu rencana) belum dibuat; cukup `categories.door_id` untuk pintu utama. Tabel penghubung ditambah saat Kabaralek dibangun.
16. **Kedaluwarsa:** `expireStaleBookings()` dipanggil dari skrip `bun run bookings:tick` dan route `/api/cron/bookings` (dilindungi `CRON_SECRET`), serta secara malas saat pesanan dibaca.
17. **Alamat aplikasi untuk tautan di pesan WA:** env `APP_URL` (cadangan `BETTER_AUTH_URL`).

## 3. Perubahan skema (Gelombang 1, lead)

Enum baru: `door_status` (active, soon, hidden), `door_kind` (single, plan, guide), `schedule_kind` (slot, seat, date_stock, survey, none), `listing_kind` (provider, place), `booking_status` (sent, accepted, in_progress, completed, rejected, expired, cancelled), `booking_actor` (citizen, provider, admin, system), `slot_block_reason` (walk_in, whatsapp, other), `qa_source` (provider, citizen), `wa_direction` (outbound, inbound), `wa_status` (queued, sent, delivered, read, failed, link).

| Tabel | Kolom penting |
|---|---|
| `doors` (baru) | slug, name, icon, description, rotating_text, aliases, sort_order, status, kind |
| `categories` (+) | door_id, schedule_kind, response_minutes |
| `locations` (+) | official_code, boundary (MultiPolygon), center (Point, turunan) |
| `listings` (+) | kind, point (turunan), point_is_public, service_radius_km |
| `units` (baru) | listing_id, name, capacity, origin_location_id, destination_location_id, is_active, sort_order |
| `schedule_rules` (baru) | unit_id, weekday (0 = Minggu), start_time, end_time (≤ start = lewat tengah malam), slot_minutes, gap_minutes, min_minutes, price, peak_price, peak_start, peak_end |
| `schedule_exceptions` (baru) | listing_id, unit_id (kosong = semua unit), date, is_closed, start_time, end_time, note |
| `slot_blocks` (baru) | unit_id, starts_at, ends_at, reason, note, created_by |
| `bookings` (baru) | code, citizen_id, listing_id, category_id, unit_id, status, starts_at, ends_at, seats, exclusive, district_id, details, rules_snapshot, price, respond_by, responded_at, completed_at, cancelled_at, reminded_at, provider_reminded_at, review_requested_at, admin_note, provider_token_hash |
| `booking_contacts` (baru) | booking_id, name, phone, address, lat, lng, note |
| `booking_events` (baru) | booking_id, from_status, to_status, actor, actor_user_id, reason |
| `reviews` (baru) | booking_id, listing_id, citizen_id, satisfied, stars, comment |
| `listing_qa` (baru) | listing_id, question, answer, source, asked_by, chat_session_id, answered_at, sort_order |
| `saved_addresses` (baru) | user_id, label, address, lat, lng, location_id |
| `wa_messages` (baru) | direction, template, phone, status, mode, booking_id, provider_message_id, params, error |
| `wa_otps` (baru) | phone, code_hash, attempts, expires_at, consumed_at |
| `app_settings` (baru) | key, value (JSON), updated_by |
| `listing_daily_stats` (baru) | listing_id, day, views, wa_clicks |
| `user` (+, Better Auth) | phone_number, phone_number_verified, privacy_consent_at; peran `citizen` |

## 4. Kontrak mesin

`src/lib/engines/contracts.ts` berisi tipe dan antarmuka empat mesin, lalu mengekspor `schedule`, `booking`, `location`, `notify`. Implementasinya di `src/lib/engines/<mesin>/index.ts` (diisi sub-agent; sebelum diisi, fungsi melempar galat "belum diisi"). Halaman, fitur, dan chat memanggil mesin hanya lewat `@/lib/engines/contracts`. Fungsi yang dipakai di dalam transaksi menerima `tx` (lihat tipe `Tx`).

## 5. Data acuan dan dummy (Gelombang 1, lead)

- Pintu: Ka main, Ka rawat diri, Ka uda anta, Ka servis (`active`); Ka manyewa, Ka jalan-jalan (`soon`); Kabatanyo, Kabaralek, Ka balanjo, Ka baubek (`hidden`).
- Kategori tahap 1 baru: lapangan futsal, mini soccer, padel, badminton, billiard, karaoke, gym, barbershop, spa & pijat, refleksi, perawatan wajah & kulit, travel antarkota, titip paket, apotek 24 jam, IGD. Kategori lama diberi pintu dan jenis jadwal (mis. Servis AC → Ka servis, `none`; Angkut Barang → Ka uda anta).
- Isian aturan contoh sesuai PRD 8.8 dan Lampiran B (padel, barbershop, travel, servis AC).
- Sebutan lain: "sewa lapangan" → Ka main, dll.
- Dummy: sekitar 10 penyedia per pintu di Padang dengan unit, jam buka, harga, dan isian aturan; ditambah beberapa Tempat. Unit dan jadwal dibuat `seed-dummy.ts` dari kategori (tidak lewat CSV).

## 6. Pembagian kerja sub-agent

Sesuai tabel di `docs/prompt-tahap1.md`, dengan tambahan:

| Sub-agent | Tambahan folder milik |
|---|---|
| `agent-pesanan` | `src/app/api/cron/` (route kedaluwarsa), `scripts/bookings-tick.ts` |
| `agent-ui-mitra` | halaman token penyedia `src/app/mitra/pesanan/t/[token]/` (bagian dari `src/app/mitra/`) |
| `agent-ui-warga` | `src/app/pesanan/`, `src/app/masuk/` (halaman warga di luar `(publik)`) bila diperlukan; disarankan tetap di `(publik)` |

File bersama tetap milik lead: `src/db/schema.ts`, migrasi, `src/db/data/`, seed, `package.json`, `src/lib/engines/contracts.ts`, `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/session.ts`, `src/proxy.ts`, `src/components/icons.tsx`, `env.example.txt`.
