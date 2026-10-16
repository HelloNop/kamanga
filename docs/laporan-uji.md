# Laporan uji Gelombang 4 — tahap 1

Ditulis agent-penguji, 15 Okt 2026. Diuji terhadap working tree cabang `chore/prd-baru-tahap1` (commit `b7753b0` ditambah perubahan lead yang belum di-commit di `booking-form.tsx`, `store.ts`, `chat-view.tsx`, `contracts.ts`, `paths.ts`), database `kamanga_v2`, server dev `http://localhost:3000` dalam **mode cadangan WA** (tanpa env WA).

Tanpa browser: alur diuji lewat mesin (kontrak), server action dan halaman lewat HTTP ke server dev, dan tampilan lewat analisis CSS statis.

## Status perbaikan (lead, setelah laporan ini)

| Temuan | Status | Perbaikan |
|---|---|---|
| K1 | **Diperbaiki** | `src/lib/auth.ts`: nomor WA hanya tercatat lewat `/phone-number/verify`; daftar email membuang `phoneNumber`, ubah profil yang menyentuh nomor ditolak. Lapis kedua `isCitizen()` (nomor terverifikasi) di `requireCitizen` dan server action warga. Uji baru `check:auth`; `check:e2e` bagian 10 lulus. |
| S1 | **Diperbaiki** | Mesin Pesanan menolak "selesai" sebelum `starts_at`; tombol disembunyikan di halaman mitra dan token. |
| S2 | **Diperbaiki** | Hapus akun membatalkan pesanan aktif sebagai `system` (melewati batas pembatalan, UU PDP) dan memberi tahu penyedia. |
| S3 | **Diperbaiki** | Antrean "Pesan ke warga yang perlu dikirim" di `/dashboard/bookings` (mode cadangan): tautan wa.me berisi teks terisi, lalu ditandai terkirim. |
| S4 | **Diperbaiki** | Assert "Lubuk" menerima hasil ambigu atau hasil pencarian terbanyak; aturan pencarian terbanyak tetap diuji terkendali (Andaleh). |
| R1 | **Diperbaiki** | Tema panel: `--muted-foreground` terang #646a74 (4.96:1); `--primary` gelap #6aa9c6 dengan teks #0f1b22 (6.1–6.8:1). |
| R2, R3, R5 | **Diperbaiki** | Target sentuh chat dan /jelajah 44 px; placeholder chat tanpa transparansi. |
| R4 | **Diperbaiki** | Terbukti di browser (402 px). Ajakan "Daftarkan usaha" disembunyikan di ≤ 420 px; tautan header rata tengah 44 px. |
| R6 | Bukan masalah | Pucat hanya saat animasi muncul (8.71:1). |
| R7, R8, R9, R10 | Terbuka | Dicatat di `docs/PROGRESS.md` (masalah terbuka). |
| R11 | **Diperbaiki** | Batas OTP per IP, wajib header Origin, hitungan batas dikunci (migrasi `0013_otp_ip_hash.sql`). |

Setelah perbaikan: `check:e2e` 18/18 tanpa temuan, `check:tampilan` 0 temuan, semua `check:*` lulus, lint 0 galat.

## Cara menjalankan

```bash
bun run tests/e2e.check.ts        # usulan script: check:e2e (butuh server dev + data acuan + dummy)
bun run tests/tampilan.check.ts   # usulan script: check:tampilan (hanya membaca berkas CSS/TSX)
```

`tests/e2e.check.ts` memanggil server action seperti klien Next (header `Next-Action`), memakai id dari `.next/dev/server/server-reference-manifest.json`. Halaman yang memuat aksinya harus sudah pernah dibuka sekali agar aksinya terdaftar. Kode OTP mode cadangan ditangkap dari log proses uji (`notify.requestOtp`), lalu diverifikasi lewat `POST /api/auth/phone-number/verify` ke server. Mitra dan admin mendaftar lewat `POST /api/auth/sign-up/email` (sandi acak), peran admin dinaikkan langsung di database. Kedua skrip sengaja **gagal** selama temuan di bawah belum diperbaiki.

## Ringkasan

| Bagian | Hasil |
|---|---|
| `bun run typecheck` | Lulus |
| `bun run lint` | Lulus: 0 galat, 159 peringatan (Gelombang 0: 92). Berkas `tests/` bersih. |
| 16 script `check:*` | 15 lulus. **`check:location` gagal** (S4) |
| `bun run eval:chat` | 61/64 benar (95%), 55/64 (86%) tanpa AI. 3 meleset (R9) |
| Empat alur warga + penyedia menerima (e2e 1–4) | **Lulus.** Ka main, Ka rawat diri, Ka uda anta, dan Ka servis berjalan dari `findProviders` sampai ulasan |
| Privasi kontak sebelum diterima (e2e 1, 9, 12, 15) | **Lulus.** Lewat token, akun pemilik, mitra lain, `listBookings`, HTML `/mitra`, pesan WA, dan log WA tidak memuat nomor, nama, atau alamat warga |
| Koordinat perangkat (e2e 11) | **Lulus.** Titik tidak tersimpan di tabel mana pun. Kontrol positif (alamat yang sengaja disimpan) terdeteksi |
| Hapus akun (e2e 13, 16) | Sebagian. Kontak, alamat, OTP, dan nomor di log WA terhapus. **Pesanan yang sudah lewat batas pembatalan tidak dibatalkan** (S2) |
| Anti-bentrok (e2e 5–8) | **Lulus.** Dua pesanan serentak di slot yang sama (lewat mesin dan lewat HTTP): tepat satu berhasil. Kursi travel terakhir: tepat satu berhasil. Slot yang diblokir ditolak. Blokir di atas pesanan ditolak |
| Keamanan server action dan route (e2e 9–10) | **Gagal: kritis** (K1). Selain itu, 15 kasus akses tanpa sesi, peran salah, atau milik orang lain ditolak; cron, webhook, dan OTP lintas asal ditolak |
| Ditolak/kedaluwarsa (e2e 15) | Lulus di mesin. Pemberitahuan ke warga di mode cadangan tidak sampai (S3) |
| Halaman per peran (e2e 17–18) | **Lulus.** 200/307 sesuai peran tanpa galat runtime; beranda tanpa akun dan tanpa panggilan AI |
| Tampilan 360 px | Lulus statis: tidak ada lebar tetap > 328 px. Ada dugaan header chat melebar (R4), perlu dicek di browser |
| Target sentuh 44 px | Warga dan mitra lulus. **Chat dan /jelajah gagal** (R2, R3) |
| Kontras 4.5:1 | Token warga dan chat lulus (teks berganti 8.71:1). **Token tema panel gagal** (R1), placeholder chat 3.97:1 (R5) |

Hitungan per tingkat: **1 kritis, 0 tinggi, 4 sedang, 11 rendah**, ditambah 1 catatan.

---

## Kritis

### K1. Daftar email menerima `phoneNumber`: akun warga palsu dan pengambilalihan akun warga asli

- **Pemilik:** lead (`src/lib/auth.ts`, berkas bersama). Pengaman lapis kedua di agent-ui-warga (`src/features/warga/api/service.ts`, `repository.ts`).
- **Melanggar:** aturan keras 5 (privasi) dan PRD 8.7 (akun warga lewat OTP).
- **Langkah reproduksi** (otomatis di `tests/e2e.check.ts` bagian 10):
  1. `POST /api/auth/sign-up/email` dengan body `{ email, password, name, phoneNumber: "62899…" }` (nomor milik orang lain, tanpa OTP). Hasilnya HTTP 200.
  2. Di database terbentuk akun berperan **`citizen`** dengan `phone_number` = nomor itu dan `phone_number_verified` kosong. Hook `databaseHooks.user.create.before` (auth.ts:31–40) menjadikan akun apa pun yang membawa `phoneNumber` sebagai warga, dan field `phoneNumber` dari plugin tidak bertanda `input: false`.
  3. Penyusup masuk dengan email dan sandi, lalu memanggil `completeProfile`: **berhasil**. Menurut kode, ia lalu bisa memesan atas nama nomor itu (langkah ini tidak dijalankan di uji), karena `createBookingAction` (service.ts:175) hanya memeriksa `profile.phone` dan tidak memeriksa apakah nomornya sudah diverifikasi.
  4. Pemilik nomor asli kemudian masuk dengan OTP di `/masuk`. Plugin menemukan akun yang sudah punya nomor itu, sehingga **warga masuk ke akun buatan penyusup**.
  5. Penyusup masih bisa masuk dengan email dan sandinya ke akun itu dan membuka `/pesanan` milik warga (riwayat pesanan, ulasan, alamat tersimpan).
- **Diharapkan:** `phoneNumber` hanya terisi lewat verifikasi OTP. Daftar email selalu menghasilkan akun `vendor` tanpa nomor.
- **Yang terjadi:** seperti langkah 2–5.
- **Saran:** tolak atau buang `phoneNumber` di jalur `/sign-up/email` (hook `before` dengan matcher path `/sign-up/email`, atau periksa `ctx.path` di `databaseHooks.user.create.before` dan hanya jadikan warga bila jalurnya `/phone-number/verify`). Sebagai lapis kedua, `getCitizenProfile`/`createBookingAction` mewajibkan `phoneNumberVerified = true`. Bersihkan juga akun yang mungkin sudah terlanjur dibuat dengan cara ini.

## Tinggi

Tidak ada. Keempat alur utama berjalan.

## Sedang

### S1. Penyedia bisa menandai pesanan "selesai" sebelum jadwalnya dimulai

- **Pemilik:** agent-pesanan (`src/lib/engines/booking/index.ts:318`, `completeBooking`). Tombol ada di agent-ui-mitra (`src/features/mitra/components/booking-actions.tsx:195–203`).
- **Langkah:** pesan padel untuk besok malam → penyedia Terima lewat token → langsung tekan "Tandai selesai" (`actWithToken(token, 'complete')`). e2e bagian 1.
- **Diharapkan (PRD 8.5):** "Selesai" ditandai setelah layanan berjalan, atau otomatis setelah slot lewat. Sebelum jadwal dimulai, mesin menolak dengan `invalid_transition`/`too_early`.
- **Terjadi:** berhasil. Status menjadi `completed`, warga langsung diminta ulasan ("Puas?"), dan slot yang belum dipakai ikut lepas.
- **Saran:** untuk pesanan ber-jadwal, `completeBooking` hanya boleh bila `now >= starts_at` (pesanan permintaan tanpa jadwal tetap boleh). Sembunyikan tombolnya sebelum jadwal. Temuan ini sudah dicatat lead dan kini terbukti.

### S2. Hapus akun: pesanan yang sudah diterima dan lewat batas pembatalan tetap "diterima", penyedia tidak diberi tahu

- **Pemilik:** agent-ui-warga (`src/features/warga/api/service.ts:104` `deleteAccount`; `repository.ts:303` `activeBookingIds`). Bila butuh aksi pembatalan oleh sistem, minta ke agent-pesanan.
- **Langkah** (e2e bagian 16): warga memesan padel 1–20 jam lagi (batas pembatalan dummy 1 hari) → penyedia menerima → warga menghapus akun.
- **Diharapkan:** pesanan aktif dibatalkan (atau ditandai) dan penyedia diberi tahu, karena kontak warga ikut terhapus.
- **Terjadi:** `cancelBooking` oleh warga mengembalikan `too_late`, hasilnya diabaikan, akun tetap terhapus. Pesanan tetap `accepted` tanpa kontak dan tanpa pesan `booking_cancelled` ke penyedia. Penyedia menunggu pelanggan yang tidak bisa dihubungi. `activeBookingIds` juga tidak memasukkan `in_progress`.
- **Saran:** saat hapus akun, batalkan pesanan aktif sebagai pelaku `system` dengan alasan "Akun warga dihapus" (abaikan batas pembatalan) dan kirim `booking_cancelled` ke penyedia. Atau beri tahu warga dulu bahwa pesanan X akan dibatalkan dan aturan DP berlaku.

### S3. Mode cadangan: pemberitahuan WA untuk warga tidak pernah sampai (tidak ada antrean tim)

- **Pemilik:** agent-ui-admin (antrean di `src/features/bookings/`). Keputusan alurnya di lead.
- **Langkah:** tanpa env WA, tolak sebuah pesanan lewat token, atau biarkan kedaluwarsa (e2e bagian 15). `wa_messages` mencatat `booking_rejected` / `booking_expired` berstatus `link`.
- **Diharapkan (PRD 8.5):** "warga diberi tahu" saat ditolak/kedaluwarsa, serta "Puas?" setelah selesai dan pengingat sebelum jadwal (PRD 8.6).
- **Terjadi:** di mode cadangan pesan-pesan itu hanya tercatat. Tidak ada kode di `src/features` atau `src/app` yang membaca `wa_messages` untuk ditampilkan ke tim (antrean "Perlu diteruskan" hanya untuk pesanan `sent` ke penyedia, `repository.ts:77`). Akibatnya `booking_rejected`, `booking_expired`, `booking_cancelled` (oleh penyedia/admin), `booking_reminder`, `review_request`, dan `question_answered` tidak pernah dikirim. Warga hanya tahu bila membuka `/pesanan/<id>`. Ulasan "Puas?" juga hampir tidak akan terkumpul selama API WA belum aktif. Temuan ini sudah dicatat lead dan kini terbukti.
- **Saran:** antrean "Pesan ke warga" di dashboard admin (`wa_messages` keluar, `mode = fallback`, `status = link`, peran warga) dengan tombol wa.me dan tanda "sudah dikirim", sama seperti antrean penyedia.

### S4. `check:location` gagal karena bergantung pada isi `search_logs`

- **Pemilik:** agent-lokasi (`src/lib/engines/location/location.check.ts:116`; aturan di `index.ts:200`).
- **Langkah:** `bun run check:location` setelah ada pencarian sungguhan (sekarang ada 2 baris `search_logs` untuk Lubuk Begalung dari uji browser lead).
- **Diharapkan:** uji tetap hijau di database yang sudah dipakai.
- **Terjadi:** `resolvePlaceName('Lubuk')` menjadi `resolved` → Lubuk Begalung lewat aturan (4) "paling sering dicari", padahal uji mengharapkan `ambiguous`.
- **Saran:** uji memakai nama ambigu yang tidak pernah dicari (atau memeriksa `search_logs` lebih dulu). Pertimbangkan juga ambang "jelas unggul" di aturan (4). Sekarang 2 pencarian berbanding 0 sudah cukup untuk berhenti bertanya, sehingga uji coba tim beberapa kali bisa mengubah jawaban untuk semua warga.

## Rendah

### R1. Kontras token tema panel (dashboard mitra) di bawah 4.5:1
- **Pemilik:** lead (`src/styles/themes/kamanga.css`, tidak dimiliki sub-agent).
- **Terang:** `--muted-foreground` #6c727c di atas `--muted` #f4f4f6 = **4.41:1**. Dipakai untuk teks kecil langsung di latar halaman mitra (`src/app/mitra/(panel)/pesanan/page.tsx:54`; label statistik `page.tsx:16–17` di `bg-muted/60` ≈ 4.6). Di atas kartu putih 4.84:1 (lulus).
- **Gelap** (mengikuti tema sistem): `--primary` #3f7f9c di atas `--card` #20232a = **3.54:1** (menu bawah mitra yang aktif, `mitra-nav.tsx:61`, `text-primary`). Teks putih di atas `--primary` gelap = **4.44:1** (tombol utama).
- **Saran:** gelapkan `--muted-foreground` sedikit (mis. #646a74) dan terangkan `--primary` gelap untuk teks. Diukur dengan `tests/tampilan.check.ts`.

### R2. Target sentuh < 44 px di chat
- **Pemilik:** agent-chat (`src/features/chat/chat.css`).
- `.kmg .cta` / `.btn-new` min-height 40 px (baris 188–200), `.icon-btn` 40×40 px (221, tombol tema), `.btn-new` di ≤ 520 px 40×40 px (765), `.chip` min-height **38 px** (449, tombol pilihan "satu pertanyaan dengan tombol"). Tautan header `.link-quiet.keep` di ≤ 520 px hanya padding 8px 4px (743), kira-kira 38 px.
- **Saran:** min-height/ukuran 44 px.

### R3. Target sentuh < 44 px di /jelajah
- **Pemilik:** agent-ui-warga (`src/features/jelajah/jelajah.css`).
- `.kmg .pub-search select` height 36 px (baris 132), `.kmg .pub-cats a` min-height 38 px (165).

### R4. Header chat saat percakapan berjalan kemungkinan melebihi 360 px (dugaan, perlu dicek di browser)
- **Pemilik:** agent-chat.
- Perkiraan di ≤ 520 px saat `chatting`: tombol tema 40 + "Percakapan baru" 40 + "Jelajah" ≈ 60 + "Masuk" ≈ 51 + "Mitra" ≈ 64 + jarak 24 ≈ 279 px, ditambah merek "kamanga" ≈ 74 px. Totalnya ≈ 353 px, lebih dari 328 px ruang yang tersedia (`chat.css:138` grid `1fr auto`, `.kmg { overflow-x: clip }`), sehingga tombol paling kanan bisa terpotong. Tanpa percakapan (tanpa tombol baru) masih muat (≈ 313 px).

### R5. Placeholder kolom chat 3.97:1 (mode terang)
- **Pemilik:** agent-chat (`chat.css:413`: `color: var(--muted); opacity: 0.8`). Saran: tanpa opacity (5.9:1).

### R6. "Teks berganti di beranda tampak pucat": tidak terbukti di CSS
- **Pemilik:** agent-ui-warga (`warga.css:175–197`, `rotating-text.tsx`).
- Warna `--red` #8e1b1b di atas `--paper` = **8.71:1** (lulus). Kemungkinan kesan pucat berasal dari animasi `w-in 0.4s` (opacity 0 → 1) yang diulang setiap 2,2 detik: sekitar 18% waktunya teks tampil kurang dari penuh (pada opacity 50% kontrasnya 2.72:1). Perlu dilihat di browser. Saran: animasi geser tanpa fade, atau fade lebih singkat.

### R7. Hasil kosong tanpa alasan dan tanpa pelonggaran (Ka uda anta)
- **Pemilik:** lead (`src/lib/directory/providers.ts`) dan agent-ui-warga (teks hasil kosong).
- **Langkah:** `searchDoor` Ka uda anta, lokasi Kuranji, tujuan Bukittinggi, besok. Hasilnya `items`, `uncertain`, dan `relaxations` semuanya kosong. Data sebenarnya: travel Bukittinggi hanya menjemput di Padang Barat, ≤ 5 km dari Padang Utara, dan Lubeg/Nanggalo/Padang Timur/Koto Tangah.
- **PRD 8.3:** hasil kosong harus dijelaskan alasannya ("belum ada travel yang menjemput di Kuranji") dan menawarkan pelonggaran (mis. jemput di kecamatan terdekat).

### R8. Kontak warga tetap terbuka lewat tautan token tanpa batas waktu
- **Pemilik:** agent-pesanan (`booking/index.ts:51` `CONTACT_OPEN` termasuk `completed`), dengan keputusan lead.
- Tautan token di pesan WA tidak pernah kedaluwarsa. Siapa pun yang menerima terusan pesan itu tetap bisa membaca nomor dan alamat warga, bahkan berbulan-bulan setelah selesai. Ini sesuai aturan keras 5, tetapi bertentangan dengan prinsip data minimum UU PDP. Saran: tutup kontak lewat token misalnya 7 hari setelah selesai/batal. Pemilik berakun tetap bisa melihatnya di dashboard.

### R9. `eval:chat` meleset 3 kasus
- **Pemilik:** agent-chat. Kasus `onda mogok di lubg` (typo lokasi tidak dikenali), `cari katering di padanng` (menjadi pertanyaan "lebih dari satu tempat", padahal layanan hanya Padang), dan lanjutan `padang` (diharapkan AI, hasil providers).

### R10. Peringatan lint naik dari 92 menjadi 159 (0 galat)
- **Pemilik:** masing-masing. Sebagian besar `no-console` di berkas `*.check.ts` (chat.check 33, search.check 21, booking.check 14, schedule.check 12). Saran: komentar `oxlint-disable no-console` di kepala berkas uji, seperti di `tests/`.

### R11. `/api/wa/otp` menerima permintaan tanpa header Origin; belum ada batas per IP
- **Pemilik:** agent-wa / lead (sudah ada di "Masalah terbuka"). Permintaan lintas asal (Origin lain) ditolak 403 (e2e bagian 10), tetapi skrip tanpa Origin lolos. Batasnya hanya 3 per 10 menit per nomor. Wajib ditangani sebelum API WA (OTP berbayar) diaktifkan.

### Catatan
- `CRON_SECRET` kosong di `.env.local`, sehingga `/api/cron/bookings` menjawab 503 (gagal tertutup, sesuai rancangan). Di pengembangan, kedaluwarsa tetap jalan secara malas saat dibaca, atau lewat `bun run bookings:tick`. Isi `CRON_SECRET` di produksi.

---

## Verifikasi temuan lead (PROGRESS, Gelombang 3)

| Temuan lead | Hasil uji |
|---|---|
| Pilihan di halaman pesan (sewa raket, lama) hilang setelah masuk OTP | Sedang diperbaiki lead (perubahan belum di-commit di `booking-form.tsx` dan `store.ts`: `slotKey`, `endsAt`, `racket` disimpan di draf). Belum bisa diuji tanpa browser. |
| Penyedia bisa menandai selesai sebelum jadwal dimulai | **Terbukti**: S1. |
| Header chat menampilkan "Daftar" | Sudah diperbaiki di working tree (belum di-commit): "Masuk" → `/masuk?next=/chat`, CTA singkat "Mitra". Diperiksa e2e bagian 17. |
| Teks berganti di beranda tampak pucat | Kontras statis 8.71:1. Dugaan penyebabnya animasi: R6. |
| Mode cadangan: pemberitahuan ke warga belum punya antrean tim | **Terbukti**, cakupannya lebih luas (pengingat, "Puas?", pembatalan): S3. |
| Alur klaim usaha dan notifikasi PWA belum ada | Benar. Di luar uji ini. |

## Yang lulus (bukti dari `tests/e2e.check.ts`)

1. **Ka main:** padel besok malam dekat Lubeg, 4 orang. Urut terdekat; `/pesan/<slug>?unit&mulai&selesai&kursi` 200. Pesanan `sent` → diteruskan admin (`forwardToProvider`, token sama dengan pesan pertama) → token: kontak `null`, HTML tanpa nomor/nama → Terima lewat `actWithToken` → kontak terbuka → `/pesanan/<id>` warga tanpa token penyedia → selesai → ulasan (ulasan kedua ditolak).
2. **Ka rawat diri:** barbershop slot tepat 30 menit, alur sama.
3. **Ka uda anta:** travel Padang → Bukittinggi, 2 kursi, alamat jemput. Sisa kursi berkurang 2. Alamat tertutup sebelum diterima.
4. **Ka servis:** permintaan AC dengan keluhan, tanggal, dan bagian hari. Teknisi melayani Kuranji (`isInServiceArea`). Alamat tertutup sebelum diterima.
5. **Privasi sebelum diterima:** pemilik berakun (`getBookingForProvider` dengan userId) kontak `null`. Mitra lain `null`, HTML `/mitra/pesanan/<id>` tanpa kode pesanan, `getBooking` null, `actOnMyBooking` ditolak. `listBookings` dan HTML `/mitra`, `/mitra/pesanan`, `/mitra/pesanan/<id>` tanpa data warga. Warga lain: batal ditolak, halaman 404. Token palsu dan batal lewat token ditolak.
6. **Log WA:** semua `wa_messages.params` uji tanpa nomor/nama/alamat warga, token, atau kode OTP. `otp` berisi `{}`.
7. **Koordinat perangkat:** `resolveDevicePoint`, `searchDoor` keempat pintu, `/api/chat` dengan lokasi, dan `createBookingAction` Ka servis dengan titik perangkat tidak meninggalkan digit titik di **semua** tabel `public`. `booking_contacts.lat` null, kecamatan tetap terisi.
8. **Hapus akun:** akun hilang. Pesanan tetap ada dengan `citizen_id` null dan berstatus `cancelled` (pesanan permintaan). `booking_contacts`, `saved_addresses`, `wa_otps`, dan nomor di `wa_messages` hilang. Token tidak lagi menampilkan kontak. Cookie lama dialihkan ke `/masuk`.
9. **Anti-bentrok:** dua `createBooking` serentak satu slot → tepat satu, yang lain `taken`. Dua `createBookingAction` serentak lewat HTTP → tepat satu, yang lain mendapat pesan "baru saja diambil", tanpa tautan wa.me/token di jawaban warga. Kursi travel terakhir diperebutkan → tepat satu, lalu `no_seats`. Slot diblokir: tidak tampil kosong, pesanan `blocked`. Blokir di atas pesanan aktif → `conflict`.
10. **Keamanan:** ditolak semua: `createBookingAction`, `cancelBookingAction`, dan `deleteAccount` tanpa sesi; ulasan atas pesanan warga lain; `getHome` dan `blockSlot` dengan cookie sesi palsu; mitra lain atas usaha orang (`getHome`, `blockSlot`); pemilik memblokir unit usaha lain; warga memanggil aksi mitra; `forwardToProvider` / `getBookingById` oleh tanpa sesi, mitra, dan warga; token palsu. Tidak ada blokir yang terbuat oleh pihak tak berhak. Pembanding positif (admin `getBookingById`, pemilik `getHome`/`blockSlot` unit sendiri) berhasil. `/api/cron/bookings` tanpa/salah rahasia ≠ 200. Webhook tanpa tanda tangan 401, verifikasi salah 403. OTP lintas asal 403. Daftar dengan `role: admin` ditolak (HTTP 400).
11. **Ditolak/kedaluwarsa:** tolak lewat token tanpa tombol berisi nomor warga. Alasan tampil ke warga, alternatif ditawarkan. Kedaluwarsa berubah saat dibaca, `booking_expired` tercatat, Terima setelah kedaluwarsa ditolak, slot kembali kosong.
12. **Halaman per peran:** tamu (`/`, 4 pintu, `/chat`, `/masuk`, `/pesan/<slug>` keempat penyedia, token) 200. `/pesanan`, `/akun` → `/masuk`. `/mitra`, `/dashboard` → `/auth/sign-in`. Warga: `/pesanan`, `/pesanan/<id>`, `/akun` 200; `/dashboard` → `/`; `/mitra` 307. Mitra: 9 halaman `/mitra` 200; `/dashboard/bookings` 307; `/pesanan/<id>` → `/masuk`. Admin: 8 halaman `/dashboard` 200. Tidak ada galat runtime di HTML.
13. **Beranda:** pintu aktif dan "segera" tampil dari tabel `doors`, pintu tersembunyi tidak tampil. Tidak ada panggilan `llm_calls`. Ada tautan masuk warga.

## Permintaan ke lead (file bersama)

- Daftarkan di `package.json`: `"check:e2e": "bun run tests/e2e.check.ts"` dan `"check:tampilan": "bun run tests/tampilan.check.ts"`. Keduanya gagal sampai K1, S1, S2 (e2e) dan R1–R3 (tampilan) diperbaiki. `check:e2e` butuh server dev menyala.
- Perbaikan K1 di `src/lib/auth.ts` (milik lead).
- Token tema di `src/styles/themes/kamanga.css` (R1).

## Data uji

Semua data uji dibuat dan dihapus oleh `tests/e2e.check.ts` di blok `finally`: akun `e2e-<run>-…@test.invalid` dan nomor `62899…`, pesanan, blokir slot, sesi chat beserta `search_logs`/`llm_calls`-nya, log WA, dan kode OTP. `owner_id` listing dummy yang dipinjam dikembalikan ke `null`. Setelah run terakhir: hitungan awal = akhir (`bookings 0, user 1, wa_messages 0, wa_otps 0, slot_blocks 0, chat_sessions 2, search_logs 2, saved_addresses 0, reviews 0, listing ber-owner 0`). Tidak ada akun `@test.invalid` atau `62899…`, dan sisa sesi hanya milik admin.
